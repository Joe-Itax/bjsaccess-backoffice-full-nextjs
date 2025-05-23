import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Prisma, prisma } from "@/lib/prisma";
import { paginationQuery } from "@/utils/pagination";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;

  try {
    const categories = await paginationQuery(prisma.category, page, limit, {
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(categories, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des catégories :", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue lors de la récupération des catégories.";

    return NextResponse.json(
      {
        message: "Erreur lors de la récupération des catégories",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    // 1. Parser le corps de la requête
    const { name, description } = await req.json();

    // 2. Valider les données
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { message: "Le nom de la catégorie est requis." },
        { status: 400 }
      );
    }

    // 3. Générer un slug unique
    const slug = await generateUniqueSlug(name, "category");

    // 4. Créer la catégorie
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
      },
    });

    return NextResponse.json(
      {
        message: "Catégorie créée avec succès",
        category,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error && // Vérifie que la propriété 'code' existe
      typeof (error as { code: unknown }).code === "string" // Assure-toi que 'code' est une string
    ) {
      const prismaErrorCode = (error as { code: string }).code;

      if (prismaErrorCode === "P2002") {
        // C'est une erreur de violation de contrainte unique (nom/slug déjà existant)
        return NextResponse.json(
          { message: "Une catégorie avec ce nom existe déjà." },
          { status: 400 }
        );
      }
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(
        "Erreur Prisma (non P2002 ou P2002 si non capturé plus tôt):",
        error.message
      );
      return NextResponse.json(
        { message: "Une erreur liée à la base de données est survenue." },
        { status: 500 }
      );
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";

    console.error(
      "Erreur générale lors de la création de la catégorie:",
      error
    );

    return NextResponse.json(
      {
        message: "Erreur lors de la création de la catégorie",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
