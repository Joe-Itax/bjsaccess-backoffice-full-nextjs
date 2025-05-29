import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/middlewares/require-role";
import { prisma } from "@/lib/prisma";
import { removeAccents } from "@/utils/user-utils";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { deleteFileFromVercelBlob } from "@/lib/middlewares/upload-file";

export const dynamic = "force-dynamic";

const protectedAccounts = process.env.PROTECTED_ACCOUNTS?.split(",") || [];

export const config = {
  api: {
    bodyParser: false,
  },
};
// -------- GET: Récupérer un user --------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { userId } = await context.params;
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
  context: { params: Promise<{ userId: string }> }
) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const { userId } = await context.params;

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
  context: { params: Promise<{ userId: string }> }
) {
  // const notAllowed = await requireRole("ADMIN");
  // if (notAllowed) return notAllowed;

  // const { userId } = await context.params;

  // try {
  //   await prisma.$transaction(async (tx) => {
  //     const user = await tx.user.findUnique({
  //       where: { id: userId },
  //       select: {
  //         id: true,
  //         role: true,
  //         name: true,
  //         email: true,
  //         image: true,
  //         posts: {
  //           select: {
  //             id: true,
  //             featuredImage: true,
  //           },
  //         },
  //       },
  //     });

  //     if (!user) {
  //       throw new Error("Utilisateur non trouvé");
  //     }

  //     if (
  //       protectedAccounts.some(
  //         (entry: unknown) =>
  //           typeof entry === "string" && user.email.includes(entry as string)
  //       ) ||
  //       protectedAccounts.some((protectedName) =>
  //         removeAccents(user.name ?? "")
  //           .toLowerCase()
  //           .includes(protectedName.toLowerCase())
  //       )
  //     ) {
  //       throw new Error("Utilisateur protégé!!! Impossible de le supprimer");
  //     }

  //     // Supprimer la photo de profil de l'utilisateur si elle existe
  //     if (user.image) {
  //       try {
  //         await deleteFileFromVercelBlob(user.image);
  //         console.log("Photo d'avatar du User supprimé avec succès.");
  //       } catch (unlinkError) {
  //         console.warn(
  //           `Impossible de supprimer l'image de profil ${user.image}:`,
  //           unlinkError
  //         );
  //       }
  //     }

  //     await tx.comment.deleteMany({
  //       where: { visitorEmail: user.email },
  //     });

  //     for (const post of user.posts) {
  //       // Supprimer l'image à la une du post si elle existe
  //       if (post.featuredImage) {
  //         try {
  //           await deleteFileFromVercelBlob(post.featuredImage);
  //         } catch (unlinkError) {
  //           console.warn(
  //             `Impossible de supprimer l'image à la une ${post.featuredImage}:`,
  //             unlinkError
  //           );
  //         }
  //       }

  //       await tx.tagsOnPosts.deleteMany({
  //         where: { postId: post.id },
  //       });

  //       await tx.comment.deleteMany({
  //         where: { postId: post.id },
  //       });
  //     }

  //     await tx.post.deleteMany({
  //       where: { authorId: userId },
  //     });

  //     await tx.user.delete({
  //       where: { id: userId },
  //     });
  //   });

  //   return NextResponse.json({
  //     message:
  //       "L'Utilisateur et toutes ses données associées ont été supprimés définitivement",
  //   });
  // } catch (error) {
  //   if (error instanceof Error && error.message === "Utilisateur non trouvé") {
  //     return NextResponse.json(
  //       {
  //         error: "Utilisateur non trouvé",
  //       },
  //       { status: 404 }
  //     );
  //   }
  //   if (
  //     error instanceof Error &&
  //     error.message.includes("Utilisateur protégé")
  //   ) {
  //     return NextResponse.json(
  //       {
  //         message: error.message,
  //       },
  //       { status: 403 }
  //     );
  //   }
  //   console.error("Erreur lors de la suppression de l'utilisateur:", error);
  //   return NextResponse.json(
  //     {
  //       error:
  //         error instanceof Error
  //           ? error.message
  //           : "Erreur lors de la suppression de l'utilisateur",
  //     },
  //     { status: 500 }
  //   );
  // }
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const { userId } = await context.params;

  // --- Step 1: Fetch user and associated images (outside transaction) ---
  // We need this information regardless of the transaction outcome for potential image deletion.
  let userToDelete: {
    id: string;
    role: Role;
    name: string;
    email: string;
    image?: string;
    posts: { id: string; featuredImage?: string }[];
  };
  const imagesToDelete: string[] = [];

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        name: true,
        email: true,
        image: true,
        posts: {
          select: {
            id: true,
            featuredImage: true,
          },
        },
      },
    });
    // if (!user) throw new Error("User not found");
    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }
    userToDelete = {
      id: user.id,
      role: user.role,
      name: user.name || "",
      email: user.email,
      image: user.image || undefined,
      posts: user.posts.map((post) => ({
        id: post.id,
        featuredImage: post.featuredImage || undefined,
      })),
    };
    // Check for protected accounts BEFORE any database changes or file deletions
    if (
      protectedAccounts.some(
        (entry) =>
          typeof entry === "string" &&
          (userToDelete.email?.includes(entry) ||
            removeAccents(userToDelete.name ?? "")
              .toLowerCase()
              .includes(entry.toLowerCase()))
      )
    ) {
      return NextResponse.json(
        { message: "Utilisateur protégé! Impossible de le supprimer." },
        { status: 403 }
      );
    }

    // Collect all image paths to delete
    if (userToDelete.image) {
      imagesToDelete.push(userToDelete.image);
    }
    for (const post of userToDelete.posts) {
      if (post.featuredImage) {
        imagesToDelete.push(post.featuredImage);
      }
    }

    // --- Step 2: Perform all database deletions within a transaction ---
    // This ensures database atomicity: all or nothing for DB operations.
    await prisma.$transaction(
      async (tx) => {
        // Delete comments made by the user
        await tx.comment.deleteMany({
          where: { visitorEmail: userToDelete.email },
        });

        // For each post, delete associated tags and comments, then the post itself.
        // We iterate to ensure associated records are cleaned up in order before deleting the post.
        for (const post of userToDelete.posts) {
          await tx.tagsOnPosts.deleteMany({
            where: { postId: post.id },
          });
          await tx.comment.deleteMany({
            where: { postId: post.id },
          });
        }
        // Delete all posts authored by the user
        await tx.post.deleteMany({
          where: { authorId: userId },
        });

        // Finally, delete the user
        await tx.user.delete({
          where: { id: userId },
        });
      },
      {
        maxWait: 10000, // Temps max d'attente (10s)
        timeout: 10000, // Timeout de la transaction (10s)
      }
    );

    // --- Step 3: Delete images from Vercel Blob (after successful DB transaction) ---
    if (imagesToDelete.length > 0) {
      const deletionPromises = imagesToDelete.map((imagePath) =>
        deleteFileFromVercelBlob(imagePath).catch((unlinkError) => {
          console.warn(
            `Impossible de supprimer l'image ${imagePath} de Vercel Blob:`,
            unlinkError
          );
          return null;
        })
      );
      await Promise.allSettled(deletionPromises);
    }

    return NextResponse.json(
      {
        message:
          "L'utilisateur et toutes ses données associées ont été supprimés définitivement.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur:", error);

    if (error instanceof Error) {
      if (error.message === "Utilisateur non trouvé") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("Utilisateur protégé")) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      // Handle Prisma-specific errors like P2025 (record not found during deletion)
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === "P2025"
      ) {
        return NextResponse.json(
          { message: "Article non trouvé ou n'a pas pu être mis à jour." }, // Or "User not found for deletion"
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: error.message || "Erreur interne du serveur.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Une erreur inconnue est survenue lors de la suppression de l'utilisateur.",
      },
      { status: 500 }
    );
  }
}
