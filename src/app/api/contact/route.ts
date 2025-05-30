import { auth } from "@/lib/auth";
import { Prisma, prisma } from "@/lib/prisma";
import { paginationQuery } from "@/utils/pagination";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;

  if (!isBackOffice) {
    return NextResponse.json(
      { message: "Accès non autorisé." },
      { status: 403 }
    );
  }

  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  try {
    const where: Prisma.ContactMessageWhereInput = {};

    const result = await paginationQuery(prisma.contactMessage, page, limit, {
      where,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        message: true,
        createdAt: true,
        isRead: true,
      },
    });

    if (result && "error" in result && result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des messages de contact:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la récupération des messages de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    // Validation des champs requis
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        {
          message: "Tous les champs (Nom, Email, Sujet, Message) sont requis.",
        },
        { status: 400 }
      );
    }

    // Validation basique de l'email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: "Format d'email invalide." },
        { status: 400 }
      );
    }

    // Création du message de contact dans la base de données
    await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject,
        message,
      },
    });

    return NextResponse.json(
      {
        message: "Votre message a été envoyé avec succès !",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de contact:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de l'envoi du message de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PUT() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;

  if (!isBackOffice) {
    return NextResponse.json(
      { message: "Accès non autorisé." },
      { status: 403 }
    );
  }

  try {
    const { count } = await prisma.contactMessage.updateMany({
      where: {
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return NextResponse.json(
      { message: `${count} messages marqués comme lus.`, updatedCount: count },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour de tous les messages de contact:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message:
          "Erreur lors de la mise à jour de tous les messages de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
