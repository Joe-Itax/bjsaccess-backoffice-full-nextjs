import { Role } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";
import { prisma } from "@/lib/prisma";
import { removeAccents } from "@/utils/user-utils";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
const protectedAccounts = process.env.PROTECTED_ACCOUNTS?.split(",") || [];

export const config = {
  api: {
    bodyParser: false,
  },
};
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

  const postsCount = user._count.posts;
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
 

  const { userId } = await params;

  try {
    // await prisma.user.delete({ where: { id: params.userId } });
    // return NextResponse.json({ message: "Utilisateur supprimé" });
    await prisma.$transaction(async (tx) => {
      // 1. Vérifier que l'utilisateur existe
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
          posts: { select: { id: true } },
        },
      });

      if (!user) {
        throw new Error("Utilisateur non trouvé");
      }

      if (
        protectedAccounts.some(
          (entry: unknown) =>
            //   user.email.includes(entry)
            typeof entry === "string" && user.email.includes(entry as string)
        ) ||
        protectedAccounts.some((protectedName) =>
          removeAccents(user.name ?? "").includes(protectedName.toLowerCase())
        )
      ) {
        throw new Error("Utilisateur protégé!!! Impossible de le supprimer");
      }

      // 2. Supprimer les commentaires de l'utilisateur (s'ils existent)
      await tx.comment.deleteMany({
        where: { visitorEmail: user.email },
      });

      // 3. Pour chaque post de l'utilisateur :
      for (const post of user.posts) {
        // a. Supprimer les relations tags
        await tx.tagsOnPosts.deleteMany({
          where: { postId: post.id },
        });

        // b. Supprimer les commentaires du post
        await tx.comment.deleteMany({
          where: { postId: post.id },
        });
      }

      // 4. Supprimer tous les posts de l'utilisateur
      await tx.post.deleteMany({
        where: { authorId: userId },
      });

      // 5. Finalement supprimer l'utilisateur
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({
      message:
        "L'Utilisateur et toutes ses données associées ont été supprimés définitivement",
    });
  } catch (error) {
    // Gestion des erreurs spécifiques
    if (error instanceof Error && error.message === "Utilisateur non trouvé") {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Erreur lors de la suppression de l'utilisateur",
        },
        { status: 404 }
      );
    }
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
