import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: { tagId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { tagId } = params;

  try {
    // Using a Prisma transaction to ensure atomicity
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

      // 2. Delete the tag
      await tx.tag.delete({ where: { id: tagId } });
    });

    // If the transaction is successful, return a 200 OK response
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
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        {
          // The tag no longer exists or was not found.
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
      { message: "Error deleting tag", error: errorMessage, success: false },
      { status: 500 }
    );
  }
}
