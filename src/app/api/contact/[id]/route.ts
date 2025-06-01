import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;
  const { id } = await context.params;

  if (!isBackOffice) {
    return NextResponse.json(
      { message: "Accès non autorisé." },
      { status: 403 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { message: "ID du message manquant." },
      { status: 400 }
    );
  }

  try {
    const message = await prisma.contactMessage.findUnique({
      where: { id: id },
    });

    if (!message) {
      return NextResponse.json(
        { message: "Message non trouvé." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ...message }, { status: 200 });
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour du message de contact:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la mise à jour du message de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;
  const { id } = await context.params;

  if (!isBackOffice) {
    return NextResponse.json(
      { message: "Accès non autorisé." },
      { status: 403 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { message: "ID du message manquant." },
      { status: 400 }
    );
  }

  try {
    const updatedMessage = await prisma.contactMessage.update({
      where: { id: id },
      data: { isRead: true },
    });

    if (!updatedMessage) {
      return NextResponse.json(
        { message: "Message non trouvé." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Message marqué comme lu.", data: updatedMessage },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erreur lors de la mise à jour du message de contact:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la mise à jour du message de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;
  const { id } = await context.params;

  if (!isBackOffice) {
    return NextResponse.json(
      { message: "Accès non autorisé." },
      { status: 403 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { message: "ID du message manquant." },
      { status: 400 }
    );
  }

  try {
    await prisma.contactMessage.delete({
      where: { id: id },
    });

    return NextResponse.json(
      { message: "Message de contact supprimé avec succès." },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Erreur lors de la suppression du message de contact:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la suppression du message de contact",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
