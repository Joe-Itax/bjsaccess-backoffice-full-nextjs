import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma, prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

import { removeAccents } from "@/utils/user-utils";
import {
  handleUpload,
  deleteFileFromVercelBlob,
} from "@/lib/middlewares/upload-file";
import {
  processContentImages,
  // extractImageUrls,
} from "@/utils/process-content-images";
import { del, list } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * @route GET /api/post
 * @description Get all posts with pagination, optional category/tag filtering
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  const { searchParams } = req.nextUrl;
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const categorySlug = searchParams.get("category");
  const tagSlug = searchParams.get("tag");
  const search = searchParams.get("search");
  let searchTerm: string = "";
  if (search) searchTerm = removeAccents(search.trim());

  const isBackOffice = session?.user ? true : false;

  try {
    const where: Prisma.PostWhereInput = {
      ...(!isBackOffice && { published: true }), // Only show published posts for public access
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { tag: { slug: tagSlug } } } }),
      ...(search && {
        OR: [{ title: { contains: searchTerm, mode: "insensitive" } }],
      }),
    };

    const selectBase: Prisma.PostSelect = {
      id: true,
      title: true,
      slug: true,
      content: true,
      featuredImage: true,
      createdAt: true,
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
    };

    const selectBackOffice: Prisma.PostSelect = {
      published: true,
      updatedAt: true,
      comments: {
        select: {
          id: true,
          content: true,
          visitorName: true,
          visitorEmail: true,
          postId: true,
          isApproved: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    };

    // Construct the final select object
    const finalSelect = {
      ...selectBase,
      ...(isBackOffice ? selectBackOffice : {}),
    };

    const result = await paginationQuery(prisma.post, page, limit, {
      where,
      select: finalSelect as Prisma.InputJsonValue,
      orderBy: { createdAt: "desc" },
    });

    // If paginationQuery returns an error object (e.g., invalid page/limit)
    if (result && "error" in result && result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching all posts:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json(
      { message: "Error fetching posts", error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/post
 * @description Create a new post
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let featuredImagePath: string | null = null;
  let newPostSlug: string | null = null;

  try {
    const formData = await req.formData();

    const requiredFields = ["title", "content", "categoryId", "featuredImage"];
    const missingFields = requiredFields.filter(
      (field) => !formData.get(field)
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          message: "Champs obligatoires manquants",
          requiredFields: missingFields,
        },
        { status: 400 }
      );
    }

    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const categoryId = formData.get("categoryId") as string;
    const featuredImageFile = formData.get("featuredImage") as Blob;

    // Le slug est généré avant tout, car il est utilisé pour le répertoire des images
    newPostSlug = await generateUniqueSlug(title, "post");

    try {
      // 1. Upload de l'image à la une (featuredImage)
      const prefix = `featured-${Date.now()}-${newPostSlug}`;
      featuredImagePath = await handleUpload({
        file: featuredImageFile,
        folder: "featured-images",
        filenamePrefix: prefix,
      });

      // 2. Créer l'article initialement SANS les images traitées de l'éditeur
      await prisma.post.create({
        data: {
          title,
          searchableTitle: removeAccents(title),
          slug: newPostSlug,
          content: "", // Contenu vide ou temporaire, sera mis à jour ensuite
          authorId: session.user.id,
          categoryId,
          featuredImage: featuredImagePath,
        },
        select: { slug: true },
      });

      // 3. Traitement des images du contenu (déplacement de temp/ vers editor-images/postSlug/)
      // C'est ici que les images sont déplacées vers le répertoire du slug de l'article
      const { updatedHtml: processedContent } = await processContentImages(
        content,
        newPostSlug
      );

      // 4. Extraction et formatage des tags
      const extractedTags = new Set<string>();
      const hashtagRegex = /#([\p{L}\p{N}_]+)/gu;
      let match;
      let finalContentWithTags = processedContent;

      while ((match = hashtagRegex.exec(processedContent)) !== null) {
        extractedTags.add(match[1]);
      }

      const tagOperations = [];
      for (const tagName of extractedTags) {
        tagOperations.push(
          prisma.tag.upsert({
            where: { name: tagName },
            create: {
              name: tagName,
              slug: await generateUniqueSlug(tagName, "tag"),
            },
            update: {},
          })
        );
      }
      const tags = await Promise.all(tagOperations);
      const finalTagIds = tags.map((tag) => tag.id);

      for (const tag of tags) {
        const replaceRegex = new RegExp(`#(${tag.name})\\b`, "gu");
        finalContentWithTags = finalContentWithTags.replace(
          replaceRegex,
          `<span class="tiptap-tag">#$1</span>`
        );
      }

      // 5. Mise à jour de l'article avec le contenu traité et les tags
      const post = await prisma.$transaction(
        async (tx) => {
          const categoryExists = await tx.category.count({
            where: { id: categoryId },
          });
          if (!categoryExists) {
            throw new Error("Catégorie non trouvée.");
          }

          return await tx.post.update({
            where: { slug: newPostSlug! },
            data: {
              content: finalContentWithTags,
              tags: {
                create: finalTagIds.map((tagId) => ({ tagId })),
              },
            },
            include: {
              category: true,
              tags: { include: { tag: true } },
              author: { select: { id: true, name: true, image: true } },
            },
          });
        },
        {
          maxWait: 10000,
          timeout: 10000,
        }
      );

      return NextResponse.json(
        { message: "Article créé avec succès.", post },
        { status: 201 }
      );
    } catch (error) {
      // --- LOGIQUE DE NETTOYAGE EN CAS D'ÉCHEC DE POST (TRY IMBRIQUÉ) ---
      console.error("Erreur dans le processus de création détaillé:", error);

      // 1. Nettoyer l'image à la une si elle a été uploadée
      if (featuredImagePath) {
        try {
          await deleteFileFromVercelBlob(featuredImagePath);
          console.log(
            "Nettoyage: Image à la une temporaire supprimée après échec POST."
          );
        } catch (unlinkError) {
          console.error(
            "Échec de la suppression de l'image à la une temporaire:",
            unlinkError
          );
        }
      }

      // 2. Supprimer l'article créé initialement (s'il existe)
      // et par extension, le répertoire d'images associé
      if (newPostSlug) {
        try {
          // Supprimer le post de la DB
          await prisma.post.delete({ where: { slug: newPostSlug } });
          console.log(
            `Nettoyage: Article temporaire (${newPostSlug}) supprimé de la DB.`
          );

          // Supprimer le répertoire d'images créé pour ce post
          const blobDirectoryPrefix = `uploads/editor-images/${newPostSlug}/`;
          const { blobs } = await list({ prefix: blobDirectoryPrefix });
          if (blobs.length > 0) {
            const pathsToDelete = blobs.map((blob) => blob.pathname);
            await del(pathsToDelete);
            console.log(
              `Nettoyage: Répertoire d'images '${blobDirectoryPrefix}' supprimé.`
            );
          } else {
            console.log(
              `Nettoyage: Aucun image trouvée dans '${blobDirectoryPrefix}' à supprimer.`
            );
          }
        } catch (cleanError) {
          console.error(
            `Échec du nettoyage de l'article/répertoire d'images après erreur POST:`,
            cleanError
          );
        }
      }
      throw error; // Re-jeter l'erreur pour la gestion globale
    }
  } catch (error) {
    console.error("Erreur création article (globale):", error);
    if (error instanceof Error) {
      if (error.message.includes("Catégorie")) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      if (error.message.includes("unique constraint")) {
        return NextResponse.json(
          { message: "Un article avec ce titre existe déjà." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      {
        message: "Erreur lors de la création",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
