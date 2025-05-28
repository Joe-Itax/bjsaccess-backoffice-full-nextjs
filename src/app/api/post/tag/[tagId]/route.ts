import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic"; // Important pour Vercel

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ tagId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { tagId } = await context.params;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Verify that the tag exists
      const tag = await tx.tag.findUnique({
        where: { id: tagId },
      });

      if (!tag) {
        return NextResponse.json(
          { message: "Tag introuvable.", success: false },
          { status: 404 }
        );
      }

      // 2. Delete all related records in the TagsOnPosts join table
      await tx.tagsOnPosts.deleteMany({
        where: {
          tagId: tagId,
        },
      });

      // 3. Now, delete the tag
      await tx.tag.delete({ where: { id: tagId } });
    });

    return NextResponse.json(
      { message: "Tag supprimé avec succès", success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la suppression du tag:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2003"
    ) {
      return NextResponse.json(
        {
          message:
            "Impossible de supprimer le tag car il est lié à d'autres ressources. Veuillez d'abord supprimer les éléments liés.",
          success: false,
        },
        { status: 409 }
      );
    }
    // Specific handling for record not found (P2025)
    else if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        {
          message: "Tag inexistant ou introuvable.",
          success: false,
        },
        { status: 404 }
      );
    }

    // General error handling
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue lors de la suppression du tag.";
    return NextResponse.json(
      {
        message: "Erreur survenue lors de la suppression du tag",
        error: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
