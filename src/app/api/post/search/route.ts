import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma, prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";
import { removeAccents } from "@/utils/user-utils";
import { Post } from "@/types/posts";

/**
 * @route GET /api/post/search
 * @description Search posts by title, content, or searchableTitle with pagination
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  const isBackOffice = session?.user ? true : false;

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q");
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;

  if (!query || query.trim() === "") {
    return NextResponse.json(
      { message: "Terme de recherche requis." },
      { status: 400 }
    );
  }

  const searchTerm = removeAccents(query.trim());

  try {
    const where: Prisma.PostWhereInput = {
      ...(!isBackOffice && { published: true }),
      OR: [
        { title: { contains: searchTerm, mode: "insensitive" } },
        { content: { contains: searchTerm, mode: "insensitive" } },
        { searchableTitle: { contains: searchTerm, mode: "insensitive" } },
      ],
    };

    const result = await paginationQuery(prisma.post, page, limit, {
      where,
      include: {
        category: true,
        tags: { include: { tag: true } },
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (result && "error" in result && result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    const formattedPosts = result.data.map((post) => ({
      ...post,
      tags:
        (post as unknown as Post).tags?.map(
          (tagObj: { tag: { id: string; name: string } }) => tagObj.tag
        ) || [],
    }));

    return NextResponse.json(
      {
        searchTerm: query,
        ...result,
        data: formattedPosts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error searching posts:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inconnue est survenue. Veuillez réessayer plus tard.";
    return NextResponse.json(
      {
        message: "Erreur lors de la recherche d'articles.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
