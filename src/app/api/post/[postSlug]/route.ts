import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { del, list } from "@vercel/blob";
import { prisma, Prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { removeAccents } from "@/utils/user-utils";
import {
  handleUpload,
  deleteFileFromVercelBlob,
} from "@/lib/middlewares/upload-file";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";
import {
  processContentImages,
  extractImageUrls,
} from "@/utils/process-content-images";

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
        published: true,
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

  let tempUploadedFeaturedImagePath: string | null = null;
  let oldFeaturedImagePathToDelete: string | null = null;
  // Ceci stockera les URLs des images qui ont été *nouvellement déplacées* du dossier temp/ vers le dossier du slug pendant cette requête PUT.
  let newlyProcessedContentImageUrls: string[] = [];

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    let newContent = formData.get("content") as string | null;
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

    const existingPostBeforeUpdate = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: {
        id: true,
        title: true,
        slug: true,
        featuredImage: true,
        content: true,
        authorId: true,
        published: true,
        searchableTitle: true,
        categoryId: true,
        tags: { include: { tag: true } },
      },
    });

    if (!existingPostBeforeUpdate) {
      return NextResponse.json(
        { message: "Article non trouvé" },
        { status: 404 }
      );
    }

    if (
      session.user.id !== existingPostBeforeUpdate.authorId &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Vous n'êtes pas autorisé à modifier cet article." },
        { status: 403 }
      );
    }

    // --- 1. Gérer l'upload de la nouvelle featuredImage (si présente) ---
    if (featuredImageFile && featuredImageFile.size > 0) {
      if (existingPostBeforeUpdate.featuredImage) {
        oldFeaturedImagePathToDelete = existingPostBeforeUpdate.featuredImage;
      }
      const prefix = `featured-${existingPostBeforeUpdate.id}-${existingPostBeforeUpdate.slug}`;
      tempUploadedFeaturedImagePath = await handleUpload({
        file: featuredImageFile,
        folder: "featured-images", // Le dossier où sont stockées les images à la une
        filenamePrefix: prefix,
      });
    }

    // --- 2. Traitement des images du contenu ---
    const oldContentImageUrls = extractImageUrls(
      existingPostBeforeUpdate.content
    );

    const {
      updatedHtml: processedContent,
      imageUrlsToDelete,
      newlyProcessedImageUrls: tempNewlyProcessedContentImageUrls,
    } = await processContentImages(
      newContent,
      existingPostBeforeUpdate.slug,
      oldContentImageUrls
    );
    newContent = processedContent;

    // Assigner les images nouvellement traitées pour le nettoyage en cas d'échec
    newlyProcessedContentImageUrls = tempNewlyProcessedContentImageUrls;

    // --- 3. Gérer les tags ---
    let finalTagIds: string[] = [];
    let finalContentWithTags = newContent;

    if (newContent && newContent !== existingPostBeforeUpdate.content) {
      const extractedTags = new Set<string>();
      const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
      let match;
      while ((match = hashtagRegex.exec(newContent)) !== null) {
        extractedTags.add(match[1]);
      }

      for (const tagName of extractedTags) {
        let tag = await prisma.tag.findUnique({ where: { name: tagName } });
        if (!tag) {
          const uniqueSlug = await generateUniqueSlug(tagName, "tag");
          tag = await prisma.tag.create({
            data: { name: tagName, slug: uniqueSlug },
          });
        }
        finalTagIds.push(tag.id);
      }
      for (const tagName of extractedTags) {
        const replaceRegex = new RegExp(`#(${tagName})\\b`, "gu");
        finalContentWithTags = finalContentWithTags.replace(
          replaceRegex,
          `<span class="tiptap-tag">#$1</span>`
        );
      }
    } else {
      finalTagIds = existingPostBeforeUpdate.tags.map((t) => t.tagId);
      finalContentWithTags = newContent ?? existingPostBeforeUpdate.content;
    }

    // --- 4. Exécuter la transaction de mise à jour Prisma ---
    const updatedPost = await prisma.$transaction(
      async (tx) => {
        const finalTitle = title ?? existingPostBeforeUpdate.title;
        const newSlug = existingPostBeforeUpdate.slug;
        const newSearchableTitle = title
          ? removeAccents(title)
          : existingPostBeforeUpdate.searchableTitle;

        if (categoryId) {
          const category = await tx.category.findUnique({
            where: { id: categoryId },
          });
          if (!category) {
            throw new Error("Catégorie non trouvée");
          }
        }

        const updateData: Prisma.PostUpdateInput = {
          title: finalTitle,
          slug: newSlug,
          content: finalContentWithTags,
          category: categoryId
            ? { connect: { id: categoryId } }
            : { connect: { id: existingPostBeforeUpdate.categoryId } },
          published: published ?? existingPostBeforeUpdate.published,
          searchableTitle: newSearchableTitle,
          featuredImage:
            tempUploadedFeaturedImagePath ??
            existingPostBeforeUpdate.featuredImage,
        };

        await tx.tagsOnPosts.deleteMany({
          where: { postId: existingPostBeforeUpdate.id },
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
            author: { select: { id: true, name: true, image: true } },
            comments: true,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 10000,
      }
    );

    // --- 5. Exécuter la suppression des images APRÈS la transaction DB réussie ---
    // Supprimer l'ancienne featuredImage si une nouvelle a été uploadée
    if (oldFeaturedImagePathToDelete) {
      try {
        await deleteFileFromVercelBlob(oldFeaturedImagePathToDelete);
      } catch (unlinkError) {
        console.error(
          `Erreur lors de la suppression de l'ancienne image à la une: ${oldFeaturedImagePathToDelete}`,
          unlinkError
        );
      }
    }
    // Supprimer les images de l'éditeur qui ont été retirées du contenu
    await Promise.all(
      imageUrlsToDelete.map(async (imageUrl) => {
        try {
          await deleteFileFromVercelBlob(imageUrl);
        } catch (unlinkError) {
          console.error(
            `Erreur lors de la suppression de l'image de l'éditeur: ${imageUrl}`,
            unlinkError
          );
        }
      })
    );

    const responsePost = {
      ...updatedPost,
      tags: updatedPost.tags.map((t) => t.tag),
    };

    return NextResponse.json({ post: responsePost }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'article:", error);

    // --- LOGIQUE DE NETTOYAGE EN CAS D'ÉCHEC ---
    // Nettoyage de l'image à la une temporaire uploadée si la transaction DB échoue
    if (tempUploadedFeaturedImagePath) {
      try {
        await deleteFileFromVercelBlob(tempUploadedFeaturedImagePath);
        console.log("Nettoyage: Image à la une temporaire supprimée.");
      } catch (unlinkError) {
        console.error(
          "Échec de la suppression de l'image à la une temporaire après erreur de mise à jour:",
          unlinkError
        );
      }
    }

    // Nettoyage des images du nouveau contenu qui ont été *effectivement traitées/déplacées* du dossier temporaire vers le dossier permanent du post pendant cette requête.
    if (newlyProcessedContentImageUrls.length > 0) {
      try {
        await Promise.all(
          newlyProcessedContentImageUrls.map(async (url) => {
            await deleteFileFromVercelBlob(url);
          })
        );
        console.log(
          `Nettoyage: ${newlyProcessedContentImageUrls.length} images de contenu nouvellement déplacées supprimées.`
        );
      } catch (cleanError) {
        console.error(
          "Échec du nettoyage des images de contenu nouvellement déplacées après erreur de mise à jour:",
          cleanError
        );
      }
    }
    // --- FIN LOGIQUE DE NETTOYAGE ---

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    ) {
      if ((error as { code: string }).code === "P2002") {
        return NextResponse.json(
          { message: "Un article avec ce titre/slug existe déjà." },
          { status: 409 }
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
      if (error.message === "Article non trouvé") {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
      if (
        error.message === "Vous n'êtes pas autorisé à modifier cet article."
      ) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      if (error.message === "Catégorie non trouvée") {
        return NextResponse.json({ message: error.message }, { status: 400 });
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

  // Store the image path to delete *after* the transaction
  let featuredImagePathToDelete: string | null = null;

  try {
    const post = await prisma.post.findUnique({
      where: { slug: postSlug },
      select: { id: true, authorId: true, featuredImage: true },
    });

    if (!post) {
      return NextResponse.json(
        { message: "Article non trouvé" },
        { status: 404 }
      );
    }

    if (
      authenticatedUser?.id !== post.authorId &&
      authenticatedUser?.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Vous n'êtes pas autorisé à effectuer cette action." },
        { status: 403 }
      );
    }

    // Store the featured image path
    if (post.featuredImage) {
      featuredImagePathToDelete = post.featuredImage;
    }

    // --- SUPPRIMER LE RÉPERTOIRE ENTIER  SUR VERCEL BLOB CONTENANT LES IMAGES QUI SE TROUVE DANS LE CONTENU DU POST ---
    const blobDirectoryPrefix = `uploads/editor-images/${postSlug}/`;

    try {
      // Lister tous les blobs qui commencent par ce préfixe
      const { blobs } = await list({ prefix: blobDirectoryPrefix });

      // Supprimer chaque blob trouvé
      if (blobs.length > 0) {
        const pathsToDelete = blobs.map((blob) => blob.pathname);
        await del(pathsToDelete);
        console.log(
          `Supprimé ${blobs.length} images du répertoire ${blobDirectoryPrefix}`
        );
      } else {
        console.log(
          `Aucune image trouvée dans le répertoire ${blobDirectoryPrefix} à supprimer.`
        );
      }
    } catch (blobError) {
      console.error(
        `Erreur lors de la suppression du répertoire Vercel Blob pour le slug ${postSlug}:`,
        blobError
      );
      // Log l'erreur mais ne bloque pas le reste du processus de suppression de la BDD
    }
    // --- FIN LOGIQUE ---

    // Perform all database operations within the transaction
    await prisma.$transaction(
      async (tx) => {
        await tx.comment.deleteMany({ where: { postId: post.id } });
        await tx.tagsOnPosts.deleteMany({ where: { postId: post.id } });
        await tx.post.delete({ where: { slug: postSlug } });
      },
      {
        maxWait: 10000,
        timeout: 10000,
      }
    );

    // --- Start: FEATURED IMAGE FILE deletion ---
    if (featuredImagePathToDelete) {
      try {
        await deleteFileFromVercelBlob(featuredImagePathToDelete);
      } catch (unlinkError) {
        console.error(
          "Erreur lors de la suppression de l'image à la une:",
          unlinkError
        );
        // Log the error but don't block the response, as the DB update was successful.
      }
    }
    // --- End: File deletion ---

    return NextResponse.json(
      { message: "Article et images associées supprimés avec succès." },
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
        { message: "Article non trouvé ou déjà supprimé." },
        { status: 404 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Article non trouvé") {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
      if (
        error.message === "Vous n'êtes pas autorisé à effectuer cette action."
      ) {
        return NextResponse.json({ message: error.message }, { status: 403 });
      }
      return NextResponse.json(
        {
          message:
            error.message || "Erreur lors de la suppression de l'article.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Une erreur inconnue est survenue lors de la suppression de l'article.",
      },
      { status: 500 }
    );
  }
}
