import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;

  try {
    const tags = await paginationQuery(prisma.tag, page, limit, {
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(tags, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des tags:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur est survenue lors de la récupération des tags.";

    return NextResponse.json(
      {
        message: "Erreur lors de la récupération des tags",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const { name } = await req.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { message: "Nom du Tag est requis." },
        { status: 400 }
      );
    }

    const nameTag = name
      .toString()
      .normalize("NFD") // Normalise pour gérer les accents (si non fait par removeAccents avant)
      .trim()
      .replace(/\s+/g, "_") // Remplace les espaces par des underscores
      // Remplace tous les caractères qui ne sont PAS des lettres (a-z, A-Z), chiffres (0-9) ou underscores par un underscore
      .replace(/[^\p{L}\p{N}_]+/gu, "_") // Utilisation de \p{L} pour toutes les lettres Unicode, \p{N} pour les chiffres
      .replace(/__+/g, "_") // Consolider les underscores multiples en un seul
      .replace(/^_/, "") // Supprimer l'underscore en début de chaîne si présent
      .replace(/_$/, ""); // Supprimer l'underscore en fin de chaîne si présent

    // Généreration du slug unique (basé sur le nom original du tag)
    const slug = await generateUniqueSlug(name, "tag");

    const tag = await prisma.tag.create({
      data: {
        name: nameTag,
        slug,
      },
    });

    return NextResponse.json(
      {
        message: "Tag créée avec succès",
        tag,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating tag:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Un tag avec ce nom existe déjà." },
        { status: 400 }
      );
    }

    // General error handling
    const errorMessage =
      error instanceof Error ? error.message : "Une erreur est survenue.";
    return NextResponse.json(
      { message: "Erreur lors de la création du Tag", error: errorMessage },
      { status: 500 }
    );
  }
}
