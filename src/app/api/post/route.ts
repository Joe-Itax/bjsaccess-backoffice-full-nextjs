import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma, prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

import { removeAccents } from "@/utils/user-utils";
import { handleUpload } from "@/lib/middlewares/upload-file";
import fs from "fs";

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

  const isBackOffice = session?.user ? true : false;

  try {
    const where: Prisma.PostWhereInput = {
      ...(!isBackOffice && { published: true }), // Only show published posts for public access
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(tagSlug && { tags: { some: { tag: { slug: tagSlug } } } }),
    };

    const selectBase: Prisma.PostSelect = {
      id: true,
      title: true,
      slug: true,
      // Note: `content` is often truncated for listings or retrieved in full on single post pages.
      // For a list, you might only select a snippet or rely on the frontend to truncate.
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
        // Include comments with moderation details for back-office
        select: {
          id: true,
          content: true,
          visitorName: true,
          visitorEmail: true, // Always show email in back-office
          postId: true,
          isApproved: true, // Always show approval status in back-office
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
      select: finalSelect as Prisma.InputJsonValue, // Type assertion to PostSelect for complex nested select types
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

  let tempImagePath: string | null = null;

  try {
    const formData = await req.formData();
    const title = formData.get("title") as string;
    let content = formData.get("content") as string;
    const categoryId = formData.get("categoryId") as string;
    const authorId = session?.user.id as string;
    const featuredImageFile = formData.get("featuredImage") as Blob | null;

    // --- Validation des champs obligatoires ---
    if (!title || !content || !categoryId || !featuredImageFile) {
      const missingFields = [];
      if (!title) missingFields.push("title");
      if (!content) missingFields.push("content");
      if (!categoryId) missingFields.push("categoryId");
      if (!featuredImageFile) missingFields.push("featuredImage");

      return NextResponse.json(
        {
          message:
            "Tous les champs obligatoires (titre, contenu, catégorie, image à la une) doivent être fournis.",
          requiredFields: missingFields,
        },
        { status: 400 }
      );
    }

    // --- Validation de la taille de l'image (backend check pour la sécurité) ---
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB en octets
    if (featuredImageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "L'image à la une ne doit pas dépasser 5 Mo." },
        { status: 400 }
      );
    }

    // --- Reject extra fields ---
    const allowedFields = new Set([
      "title",
      "content",
      "categoryId",
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

    // --- Extraction, création et stylisation des tags à partir du contenu HTML ---
    const extractedTags = new Set<string>(); // Utilisation de Set pour éviter les doublons
    const hashtagRegex = /#(\w+)/g; // Capture le mot après '#'

    // Utilise une copie temporaire pour la regex pour éviter les problèmes avec `lastIndex`
    const tempContentForRegex = content;
    let match;
    while ((match = hashtagRegex.exec(tempContentForRegex)) !== null) {
      // Pour éviter des boucles infinies sur des regex malformées ou du contenu très grand
      if (match.index === hashtagRegex.lastIndex) {
        hashtagRegex.lastIndex++;
      }
      extractedTags.add(match[1]); // Ajoute le mot sans le '#'
    }

    const finalTagIds: string[] = [];

    // Créer ou récupérer les IDs des tags extraits
    for (const tagName of extractedTags) {
      let tag = await prisma.tag.findUnique({
        where: { name: tagName },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { name: tagName, slug: removeAccents(tagName) },
        });
      }
      finalTagIds.push(tag.id);
    }

    // Remplacer les occurrences de tags par la balise span stylisée
    for (const tagName of extractedTags) {
      // Crée une regex pour chaque tag, sensible à la casse, et ne remplace que les occurrences de #tag
      const replaceRegex = new RegExp(`#(${tagName})\\b`, "g"); // \b pour une limite de mot
      content = content.replace(
        replaceRegex,
        `<span class="tiptap-tag">#$1</span>`
      );
    }

    let featuredImagePath: string | null = null;

    try {
      const post = await prisma.$transaction(async (tx) => {
        const category = await tx.category.findUnique({
          where: { id: categoryId },
        });
        if (!category) {
          throw new Error("Catégorie non trouvée.");
        }

        const slug = await generateUniqueSlug(title, "post");
        const searchableTitle = removeAccents(title);

        const postCreated = await tx.post.create({
          data: {
            title,
            searchableTitle,
            slug,
            content,
            authorId,
            categoryId,
            tags: {
              create: finalTagIds.map((tagId) => ({ tagId })),
            },
          },
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
        });

        const prefix = `featured-${postCreated.id}-${slug}`;
        featuredImagePath = await handleUpload({
          file: featuredImageFile,
          folder: "featured-images",
          filenamePrefix: prefix,
        });
        tempImagePath = featuredImagePath;

        return await tx.post.update({
          where: { id: postCreated.id },
          data: { featuredImage: featuredImagePath },
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
        });
      });

      return NextResponse.json(
        { message: "Article créé avec succès.", post },
        { status: 201 }
      );
    } catch (transactionError) {
      if (tempImagePath) {
        try {
          fs.unlinkSync(tempImagePath);
          console.log(
            "Cleaned up uploaded image due to transaction error:",
            tempImagePath
          );
        } catch (unlinkError) {
          console.error("Failed to delete temporary image:", unlinkError);
        }
      }
      throw transactionError;
    }
  } catch (error) {
    console.error("Error creating post:", error);

    if (tempImagePath) {
      try {
        fs.unlinkSync(tempImagePath);
        console.log(
          "Cleaned up uploaded image from initial upload due to error:",
          tempImagePath
        );
      } catch (unlinkError) {
        console.error("Failed to delete temporary image:", unlinkError);
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
          { status: 409 }
        );
      }
    }

    if (error instanceof Error) {
      if (error.message === "Catégorie non trouvée.") {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
      return NextResponse.json(
        {
          message: "Erreur lors de la création d'un article.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message:
          "Une erreur inconnue est survenue lors de la création de l'article. Veuillez réessayer plus tard.",
      },
      { status: 500 }
    );
  }
}
