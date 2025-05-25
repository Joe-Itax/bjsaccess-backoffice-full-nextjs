import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma, Prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { removeAccents } from "@/utils/user-utils";
import { handleUpload } from "@/lib/middlewares/upload-file";
import fs from "fs";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";
import path from "path";

/**
 * @route GET /api/post/:id
 * @description Get a single post by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });

  const { postId } = await params;

  const isBackOffice = session?.user ? true : false;

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        published: isBackOffice, // Only expose if back-office
        featuredImage: true,
        createdAt: true,
        updatedAt: isBackOffice, // Only expose if back-office
        authorId: isBackOffice, // Only expose if back-office
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
            visitorEmail: isBackOffice, // Only expose if back-office
            content: true,
            isApproved: isBackOffice, // Only expose if back-office
            postId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ message: "Article introuvable." }, { status: 404 });
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
      { message: "Erreur lors de la récupération de l'article.", error: errorMessage },
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
  { params }: { params: { postId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { postId } = await params;

  const authenticatedUser = session.user;
  let tempImagePath: string | null = null;

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const content = formData.get("content") as string | null;
    const categoryId = formData.get("categoryId") as string | null;
    const published = formData.get("published")
      ? JSON.parse(formData.get("published") as string)
      : undefined;
    const tagsFromFormData = formData.getAll("tagIds");

    let tagIds: string[] = [];

    if (tagsFromFormData.length > 0) {
      if (tagsFromFormData.length === 1) {
        const singleTagString = tagsFromFormData[0];
        try {
          const parsed = JSON.parse(singleTagString.toString());
          if (Array.isArray(parsed)) {
            tagIds = parsed.filter((id) => typeof id === "string");
          } else if (typeof parsed === "string") {
            tagIds = parsed
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag);
          }
        } catch (e) {
          console.error(
            "Error parsing single tag string as JSON, attempting comma-separated:",
            e
          );
          tagIds = singleTagString
            .toString()
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
        }
      } else {
        tagIds = tagsFromFormData.map((id) => id.toString());
      }
    }

    const featuredImageFile = formData.get("featuredImage") as Blob | null;

    // Reject extra fields
    const allowedFields = new Set([
      "title",
      "content",
      "categoryId",
      "tagIds",
      "published",
      "featuredImage",
    ]);
    for (const key of formData.keys()) {
      if (!allowedFields.has(key)) {
        return NextResponse.json(
          { message: `Unauthorized field detected: ${key}` },
          { status: 400 }
        );
      }
    }

    let featuredImagePath: string | undefined;
    let oldImagePathToDelete: string | null = null;

    const updatedPost = await prisma.$transaction(async (tx) => {
      // 1. Check if post exists and user has permission
      const existingPost = await tx.post.findUnique({
        where: { id: postId },
        include: { author: true },
      });

      if (!existingPost) {
        throw new Error("Article non trouvé");
      }

      if (
        authenticatedUser?.id !== existingPost.authorId &&
        authenticatedUser?.role !== "ADMIN"
      ) {
        throw new Error("Vous n'êtes pas autorisé à modifier cet article.");
      }

      // 2. Check category if provided
      if (categoryId) {
        const category = await tx.category.findUnique({
          where: { id: categoryId },
        });
        if (!category) {
          throw new Error("Catégorie non trouvée");
        }
      }

      // 3. Check tags if provided
      if (tagIds.length > 0) {
        const existingTags = await tx.tag.findMany({
          where: { id: { in: tagIds } },
        });
        if (existingTags.length !== tagIds.length) {
          throw new Error("Un ou plusieurs tags sont invalides.");
        }
      }

      // 4. Generate new slug if title changes
      let newSlug = existingPost.slug;
      let newSearchableTitle = existingPost.searchableTitle;
      if (title && title !== existingPost.title) {
        newSlug = await generateUniqueSlug(title, "post");
        newSearchableTitle = removeAccents(title);
      }

      // 5. Handle featured image update
      let prefix;
      if (featuredImageFile && featuredImageFile.size > 0) {
        if (existingPost.featuredImage) {
          oldImagePathToDelete = path.join(
            process.cwd(),
            "public",
            existingPost.featuredImage
          );

          prefix = `featured-${existingPost.id}-${existingPost.title}`;
          featuredImagePath = await handleUpload({
            file: featuredImageFile,
            folder: "featured-images",
            filenamePrefix: prefix,
          });
          tempImagePath = featuredImagePath;
        }
      }

      // Prepare update data
      const updateData: Prisma.PostUpdateInput = {
        title: title || existingPost.title,
        slug: newSlug,
        content: content || existingPost.content,
        category: {
          connect: { id: categoryId || existingPost.categoryId },
        },
        // categoryId: categoryId || existingPost.categoryId,
        ...(tagIds && {
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        }),
        published: published ?? existingPost.published,
        searchableTitle: newSearchableTitle,
        featuredImage: featuredImagePath ?? existingPost.featuredImage,
      };

      if (tagsFromFormData.length > 0 || formData.has("tagIds")) {
        await tx.tagsOnPosts.deleteMany({
          where: { postId: existingPost.id },
        });
        if (tagIds.length > 0) {
          updateData.tags = {
            create: tagIds.map((tagId) => ({ tagId })),
          };
        }
      }

      return await tx.post.update({
        where: { id: postId },
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

    // Delete old image file AFTER successful transaction
    if (oldImagePathToDelete && fs.existsSync(oldImagePathToDelete)) {
      try {
        fs.unlinkSync(oldImagePathToDelete);
        console.log("Old featured image deleted:", oldImagePathToDelete);
      } catch (unlinkError) {
        console.error("Error deleting old featured image:", unlinkError);
      }
    }

    const responsePost = {
      ...updatedPost,
      tags: updatedPost.tags.map((t) => t.tag),
    };

    return NextResponse.json({ post: responsePost }, { status: 200 });
  } catch (error) {
    console.error("Error updating post:", error);

    // If an error occurred within the transaction or upload, delete the newly uploaded image
    if (tempImagePath) {
      const fullTempImagePath = path.join(
        process.cwd(),
        "public",
        tempImagePath
      );
      try {
        if (fs.existsSync(fullTempImagePath)) {
          fs.unlinkSync(fullTempImagePath);
          console.log(
            "Cleaned up new uploaded image due to update error:",
            fullTempImagePath
          );
        }
      } catch (unlinkError) {
        console.error(
          "Failed to delete temporary image after update error:",
          unlinkError
        );
      }
    }

    // Robust error handling for Prisma unique constraint violation (P2002) or other specific errors
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    ) {
      if ((error as { code: string }).code === "P2002") {
        return NextResponse.json(
          { message: "A post with this title/slug already exists." },
          { status: 400 }
        );
      }
      if ((error as { code: string }).code === "P2025") {
        // Record not found
        return NextResponse.json(
          { message: "Post not found or could not be updated." },
          { status: 404 }
        );
      }
    }

    // Handle custom thrown errors (e.g., "Post not found", "Unauthorized", "Category not found", "Tags invalid")
    if (error instanceof Error) {
      if (
        [
          "Post not found",
          "Unauthorized to modify this post",
          "Category not found",
          "One or more tags are invalid",
        ].includes(error.message)
      ) {
        const status = error.message.includes("not found")
          ? 404
          : error.message.includes("Unauthorized")
          ? 403
          : 400;
        return NextResponse.json(
          { message: error.message },
          { status: status }
        );
      }
      // General error
      return NextResponse.json(
        { message: "Error updating post", error: error.message },
        { status: 500 }
      );
    }

    // Fallback for unknown errors
    return NextResponse.json(
      { message: "An unknown error occurred while updating the post." },
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
  { params }: { params: { postId: string } }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { postId } = await params;

  const authenticatedUser = session.user;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Check if post exists and user has permission
      const post = await tx.post.findUnique({
        where: { id: postId },
        include: { author: true },
      });

      if (!post) {
        throw new Error("Article non trouvé");
      }
      if (
        authenticatedUser?.id !== post.authorId &&
        authenticatedUser?.role !== "ADMIN"
      ) {
        throw new Error("Non autorisé à supprimer cet article");
      }

      // 2. Delete the featured image if it exists
      const featuredPath = path.join(
        process.cwd(),
        "public",
        post.featuredImage as string
      );
      if (featuredPath && fs.existsSync(featuredPath)) {
        try {
          fs.unlinkSync(featuredPath);
          console.log("Featured image deleted:", featuredPath);
        } catch (unlinkError) {
          console.error("Error deleting featured image:", unlinkError);
        }
      }

      // 3. Delete related comments
      await tx.comment.deleteMany({ where: { postId } });

      // 4. Delete tag relationships
      await tx.tagsOnPosts.deleteMany({ where: { postId } });

      // 5. Finally, delete the post
      await tx.post.delete({ where: { id: postId } });
    });

    return NextResponse.json(
      { message: "Article supprimé avec succès." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting post:", error);

    // Robust error handling for Prisma "Record not found" (P2025)
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

    // Handle custom thrown errors (e.g., "Post not found", "Unauthorized")
    if (error instanceof Error) {
      if (error.message === "Post not found") {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
      if (error.message === "Unauthorized to delete this post") {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      // General error
      return NextResponse.json(
        { message: "Error deleting post", error: error.message },
        { status: 500 }
      );
    }

    // Fallback for unknown errors
    return NextResponse.json(
      { message: "An unknown error occurred while deleting the post." },
      { status: 500 }
    );
  }
}
