import { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// -------- GET: Récupérer un user --------
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { userId } = await params;
  console.log("userId: ", userId);

  //   const user = await prisma.user.findUnique({ where: { id: userId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      isActive: true,
      _count: {
        select: {
          posts: true,
        },
      },
      posts: {
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          published: true,
          featuredImage: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user)
    return NextResponse.json(
      { error: "Utilisateur non trouvé" },
      { status: 404 }
    );

  const formattedPosts = user.posts.map((post) => ({
    ...post,
    tags: post.tags.map((tagObj) => tagObj.tag),
    author: {
      id: user.id,
      name: user.name,
      image: user.image,
    },
  }));

  // user.postsCount = user._count.posts;
  const postsCount = user._count.posts;
  // delete user._count;
  const { _count, ...finalUser } = user;
  console.log("_count: ", _count);

  return NextResponse.json({
    user: {
      ...finalUser,
      postsCount: postsCount,
      posts: formattedPosts,
    },
  });
}

// -------- PUT: Mettre à jour un user --------
export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const { userId } = await params;

  try {
    const formData = await req.formData();
    const role = formData.get("role")?.toString();
    const isActifString = formData.get("isActive");
    const isActive = isActifString === "true";

    const data = {};

    if (role) (data as { role?: Role }).role = role as Role;
    if (isActive !== undefined)
      (data as { isActive?: boolean }).isActive = isActive;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la mise à jour de l'utilisateur",
      },
      { status: 500 }
    );
  }
}

// -------- DELETE: Supprimer un user --------
export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  try {
    await prisma.user.delete({ where: { id: params.userId } });
    return NextResponse.json({ message: "Utilisateur supprimé" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la suppression de l'utilisateur",
      },
      { status: 500 }
    );
  }
}
