import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma, prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";

/**
 * @route GET /api/post/:id/comments
 * @description Get comments for a specific post with pagination
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ postSlug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;
  const { postSlug } = await context.params;
  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const approvedOnly = searchParams.get("approvedOnly") === "true";

  try {
    // Verify that the post exists
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true }, // Only need existence check
    });

    if (!post) {
      return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    const where: Prisma.CommentWhereInput = {
      postId: post.id,
      ...(approvedOnly && !isBackOffice && { isApproved: true }), // For public view, only approved comments
      // For back-office, show all comments for moderation regardless of `approvedOnly` query param
    };

    const result = await paginationQuery(prisma.comment, page, limit, {
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        visitorName: true,
        visitorEmail: isBackOffice,
        postId: true,
        isApproved: isBackOffice,
        createdAt: true,
      },
    });

    if (result && "error" in result && result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching post comments:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "Error fetching comments", error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/post/:id/comments
 * @description Add a new comment to a post
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ postSlug: string }> }
) {
  const { postSlug } = await context.params;
  const { content, visitorName, visitorEmail } = await req.json();

  if (!content || !visitorName || !visitorEmail) {
    return NextResponse.json(
      { message: "Content, visitor name, and visitor email sont requis." },
      { status: 400 }
    );
  }

  try {
    // Verify that the post exists and is published
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true, published: true },
    });

    if (!post) {
      return NextResponse.json(
        { message: "Article introuvable." },
        { status: 404 }
      );
    }

    if (!post.published) {
      return NextResponse.json(
        { message: "Impossible de commenter un article non publié." },
        { status: 403 }
      );
    }

    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        content,
        visitorName,
        visitorEmail,
        postId: post.id,
      },
    });

    return NextResponse.json(
      { message: "Commentaire ajouté avec succès.", comment },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding comment:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue.";
    return NextResponse.json(
      {
        message:
          "Une erreur est survenue lors de la publication du commentaire.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
