import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma, Prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { removeAccents } from "@/utils/user-utils";
import {
  handleUpload,
  deleteFileFromVercelBlob,
} from "@/lib/middlewares/upload-file";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

export const dynamic = "force-dynamic";

/**
 * @route GET /api/post/:slug
 * @description Get a single post by SLUG
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ postSlug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  const { postSlug } = await context.params;

  const isBackOffice = session?.user ? true : false;

  try {
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        published: isBackOffice,
        featuredImage: true,
        createdAt: true,
        updatedAt: isBackOffice,
        authorId: isBackOffice,
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
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        comments: {
          select: {
            id: true,
            visitorName: true,
            visitorEmail: isBackOffice,
            content: true,
            isApproved: isBackOffice,
            postId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { message: "Article introuvable." },
        { status: 404 }
      );
    }

    // Check permissions if not published and not back-office
    if (!post.published && !isBackOffice) {
      return NextResponse.json(
        { message: "Acces non autorisé - Article non publié." },
        { status: 403 }
      );
    }

    // Format tags for cleaner output
    const formattedPost = {
      ...post,
      tags: post.tags.map((tagObj) => tagObj.tag),
    };

    return NextResponse.json({ post: formattedPost }, { status: 200 });
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      {
        message: "Erreur lors de la récupération de l'article.",
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * @route PUT /api/post/:id
 * @description Update a post by ID
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ postSlug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { postSlug } = await context.params;

  let tempImagePath: string | null = null;

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    let content = formData.get("content") as string | null;
    const categoryId = formData.get("categoryId") as string | null;
    const published = formData.get("published")
      ? JSON.parse(formData.get("published") as string)
      : undefined;
    const featuredImageFile = formData.get("featuredImage") as Blob | null;

    const allowedFields = new Set([
      "title",
      "content",
      "categoryId",
      "published",
      "featuredImage",
    ]);
    for (const key of formData.keys()) {
      if (!allowedFields.has(key)) {
        return NextResponse.json(
          { message: `Champ non autorisé détecté: ${key}` },
          { status: 400 }
        );
      }
    }

    let featuredImagePath: string | undefined;
    let oldImagePathToDelete: string | null = null;

    const updatedPost = await prisma.$transaction(async (tx) => {
      const existingPost = await tx.post.findUnique({
        where: { slug: postSlug },
        include: { author: true, tags: true },
      });

      if (!existingPost) {
        throw new Error("Article non trouvé");
      }

      if (categoryId) {
        const category = await tx.category.findUnique({
          where: { id: categoryId },
        });
        if (!category) {
          throw new Error("Catégorie non trouvée");
        }
      }

      let finalTagIds: string[] = [];
      if (content && content !== existingPost.content) {
        const extractedTags = new Set<string>();
        const hashtagRegex = /#(\w+)/g;

        const tempContentForRegex = content;
        let match;
        while ((match = hashtagRegex.exec(tempContentForRegex)) !== null) {
          if (match.index === hashtagRegex.lastIndex) {
            hashtagRegex.lastIndex++;
          }
          extractedTags.add(match[1]);
        }

        for (const tagName of extractedTags) {
          let tag = await tx.tag.findUnique({
            where: { name: tagName },
          });

          if (!tag) {
            tag = await tx.tag.create({
              data: { name: tagName, slug: removeAccents(tagName) },
            });
          }
          finalTagIds.push(tag.id);
        }

        for (const tagName of extractedTags) {
          const replaceRegex = new RegExp(`#(${tagName})\\b`, "g");
          content = content.replace(
            replaceRegex,
            `<span class="tiptap-tag">#$1</span>`
          );
        }
      } else {
        finalTagIds = existingPost.tags.map((t) => t.tagId);
      }

      let newSlug = existingPost.slug;
      let newSearchableTitle = existingPost.searchableTitle;
      if (title && title !== existingPost.title) {
        newSlug = await generateUniqueSlug(title, "post");
        newSearchableTitle = removeAccents(title);
      }

      if (featuredImageFile && featuredImageFile.size > 0) {
        if (existingPost.featuredImage) {
          oldImagePathToDelete = existingPost.featuredImage;
        }
        const prefix = `featured-${existingPost.id}-${
          newSlug || existingPost.slug
        }`;
        featuredImagePath = await handleUpload({
          file: featuredImageFile,
          folder: "featured-images",
          filenamePrefix: prefix,
        });
        tempImagePath = featuredImagePath;
      }

      const updateData: Prisma.PostUpdateInput = {
        title: title ?? existingPost.title,
        slug: newSlug,
        content: content ?? existingPost.content,
        category: categoryId ? { connect: { id: categoryId } } : undefined,
        published: published ?? existingPost.published,
        searchableTitle: newSearchableTitle,
        featuredImage: featuredImagePath ?? existingPost.featuredImage,
      };

      await tx.tagsOnPosts.deleteMany({
        where: { postId: existingPost.id },
      });
      if (finalTagIds.length > 0) {
        updateData.tags = {
          create: finalTagIds.map((tagId) => ({ tagId })),
        };
      }

      return await tx.post.update({
        where: { slug: postSlug },
        data: updateData,
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
          comments: true,
        },
      });
    });

    if (oldImagePathToDelete) {
      try {
        await deleteFileFromVercelBlob(oldImagePathToDelete);
      } catch (unlinkError) {
        console.error(
          "Erreur lors de la suppression de l'ancienne image à la une:",
          unlinkError
        );
      }
    }

    const responsePost = {
      ...updatedPost,
      tags: updatedPost.tags.map((t) => t.tag),
    };

    return NextResponse.json({ post: responsePost }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'article:", error);

    if (tempImagePath) {
      try {
        await deleteFileFromVercelBlob(tempImagePath);
      } catch (unlinkError) {
        console.error(
          "Échec de la suppression de l'image temporaire après erreur de mise à jour:",
          unlinkError
        );
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    ) {
      if ((error as { code: string }).code === "P2002") {
        return NextResponse.json(
          { message: "Un article avec ce titre/slug existe déjà." },
          { status: 400 }
        );
      }
      if ((error as { code: string }).code === "P2025") {
        return NextResponse.json(
          { message: "Article non trouvé ou n'a pas pu être mis à jour." },
          { status: 404 }
        );
      }
    }

    if (error instanceof Error) {
      if (
        [
          "Article non trouvé",
          "Vous n'êtes pas autorisé à modifier cet article.",
          "Catégorie non trouvée",
        ].includes(error.message)
      ) {
        const status = error.message.includes("non trouvé")
          ? 404
          : error.message.includes("autorisé")
          ? 403
          : 400;
        return NextResponse.json(
          { message: error.message },
          { status: status }
        );
      }
      return NextResponse.json(
        {
          message: "Erreur lors de la mise à jour de l'article.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Une erreur inconnue est survenue lors de la mise à jour de l'article.",
      },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/post/:id
 * @description Delete a post by ID
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ postSlug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { postSlug } = await context.params;
  const authenticatedUser = session.user;

  try {
    await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { slug: postSlug },
        include: { author: true },
      });

      if (!post) {
        throw new Error("Article non trouvé");
      }
      if (
        authenticatedUser?.id !== post.authorId &&
        authenticatedUser?.role !== "ADMIN"
      ) {
        throw new Error("Vous n'êtes pas autorisé à éffectué cette action.");
      }

      if (post.featuredImage) {
        try {
          await deleteFileFromVercelBlob(post.featuredImage);
        } catch (unlinkError) {
          console.error(
            "Erreur lors de la suppression de l'image à la une:",
            unlinkError
          );
        }
      }

      await tx.comment.deleteMany({ where: { postId: post.id } });
      await tx.tagsOnPosts.deleteMany({ where: { postId: post.id } });
      await tx.post.delete({ where: { slug: postSlug } });
    });

    return NextResponse.json(
      { message: "Article supprimé avec succès." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la suppression de l'article:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Post not found or already deleted." },
        { status: 404 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Post not found") {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
      if (error.message === "Unauthorized to delete this post") {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      return NextResponse.json(
        {
          message: error.message || "Erreur lors de la suppresion de l'article",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "An unknown error occurred while deleting the post." },
      { status: 500 }
    );
  }
}
