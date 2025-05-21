import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { removeAccents } from "@/utils/user-utils";
import { paginationQuery } from "@/utils/pagination";
import { Role } from "@/generated/prisma";

interface UserWithPostCount {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  _count: {
    posts: number;
  };
}

interface TransformedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  postsCount: number;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ message: "Non authentifié." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const q = searchParams.get("q") || "";

  if (!q || typeof q !== "string") {
    return NextResponse.json(
      { message: "Veuillez fournir une requête de recherche." },
      { status: 400 }
    );
  }

  const cleanedQuery = q.trim();
  if (cleanedQuery.length < 1) {
    return NextResponse.json(
      { message: "La requête doit contenir au moins 1 caractère." },
      { status: 400 }
    );
  }

  try {
    const result = await paginationQuery(prisma.user, page, limit, {
      where: {
        OR: [
          {
            searchableName: {
              contains: removeAccents(cleanedQuery),
              mode: "insensitive",
            },
          },
          { email: { contains: cleanedQuery, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Mapper les données avec la transformation de type
    const transformedData: TransformedUser[] = result.data.map((user) => {
      const newUser: TransformedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        postsCount: (user as unknown as UserWithPostCount)._count.posts,
      };
      return newUser;
    });

    return NextResponse.json(
      {
        message: "Résultats de la recherche",
        totalItems: result.totalItems,
        limitPerPage: result.limitPerPage,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        data: transformedData,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la recherche des utilisateurs",
      },
      { status: 500 }
    );
  }
}
