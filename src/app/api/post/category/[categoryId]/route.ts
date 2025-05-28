import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma, Prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function ensureDefaultCategoryExists(tx: Prisma.TransactionClient) {
  const defaultCategoryName = "uncategorized";
  let defaultCategory = await tx.category.findUnique({
    where: { slug: defaultCategoryName },
  });

  if (!defaultCategory) {
    defaultCategory = await tx.category.create({
      data: {
        name: defaultCategoryName,
        slug: defaultCategoryName, // Ou un slug généré si le nom n'est pas le slug
        description:
          "Catégorie par défaut pour les articles sans catégorie assignée.",
      },
    });
  }
  return defaultCategory.id;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;
  const { categoryId } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Vérifier l'existence de la catégorie
      const category = await tx.category.findUnique({
        where: { id: categoryId },
        select: { id: true, name: true, _count: { select: { posts: true } } },
      });

      if (!category) {
        return {
          success: false,
          message: "Catégorie non trouvée",
          status: 404,
        };
      }

      // 2. Gérer les posts associés
      if (category._count.posts > 0) {
        const defaultCategoryId = await ensureDefaultCategoryExists(tx); // Passer le client de transaction
        await tx.post.updateMany({
          where: { categoryId },
          data: { categoryId: defaultCategoryId.toString() },
        });
      }

      // 3. Suppression
      await tx.category.delete({ where: { id: categoryId } });

      return {
        success: true,
        message: `Catégorie "${category.name}" supprimée - ${category._count.posts} posts réassignés`,
        status: 200,
      };
    });

    return NextResponse.json(
      { message: result.message, success: result.success },
      { status: result.status }
    );
  } catch (error) {
    console.error("Erreur lors de la suppression de la catégorie :", error);

    // Gestion des erreurs spécifiques à Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        // P2025: Record to delete does not exist.
        return NextResponse.json(
          {
            message: "La catégorie n'existe plus ou n'a jamais existé.",
            success: false,
          },
          { status: 404 }
        );
      }
    }

    // Gestion des autres erreurs
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la suppression de la catégorie",
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
