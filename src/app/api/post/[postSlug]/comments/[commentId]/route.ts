import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";

/**
 * @route PUT /api/post/:postId/comments/:commentId
 * @description Moderate a comment (approve/reject)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { commentId } = params;
  const { action } = await req.json(); // "approve" or "reject"

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { message: 'Action invalide. Devrait-être "approve" ou "reject".' },
      { status: 400 }
    );
  }

  try {
    // Check if the comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { message: "Commentaire non trouvé." },
        { status: 404 }
      );
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        isApproved: action === "approve",
      },
    });

    return NextResponse.json(
      {
        message: `Commentaire ${
          action === "approve" ? "approver" : "rejeter"
        }.`,
        comment: updatedComment,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error moderating comment:", error);

    // Robust error handling for Prisma "Record not found" (P2025)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Comment not found or could not be updated." },
        { status: 404 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "Error moderating comment", error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/post/:id/comments/:commentId
 * @description Delete a comment (admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { commentId } = params;

  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  try {
    // Check if the comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { message: "Commentaire introuvable." },
        { status: 404 }
      );
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json(
      { message: "Commentaire supprimé avec succès." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting comment:", error);

    // Robust error handling for Prisma "Record not found" (P2025)
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Commentaire inrouvable ou déjà supprimé." },
        { status: 404 }
      );
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message: "Erreur lors de la suppression du commentaire.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
