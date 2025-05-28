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

  try {
    const formData = await req.formData();

    // Validation des champs obligatoires
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

    // 1. Traitement de l'image
    const slug = await generateUniqueSlug(title, "post");
    const prefix = `featured-${Date.now()}-${slug}`;
    const featuredImagePath = await handleUpload({
      file: featuredImageFile,
      folder: "featured-images",
      filenamePrefix: prefix,
    });

    try {
      // 2. Extraction des tags
      const extractedTags = new Set<string>();
      const hashtagRegex = /#(\w+)/g;
      let match;
      while ((match = hashtagRegex.exec(content)) !== null) {
        extractedTags.add(match[1]);
      }

      // 3. Recherche/création des tags
      const tagOperations = [];
      for (const tagName of extractedTags) {
        tagOperations.push(
          prisma.tag.upsert({
            where: { name: tagName },
            create: {
              name: tagName,
              slug: removeAccents(tagName),
            },
            update: {},
          })
        );
      }
      const tags = await Promise.all(tagOperations);
      const finalTagIds = tags.map((tag) => tag.id);

      // 4. Formatage du contenu avec les tags
      let formattedContent = content;
      for (const tag of tags) {
        const replaceRegex = new RegExp(`#(${tag.name})\\b`, "g");
        formattedContent = formattedContent.replace(
          replaceRegex,
          `<span class="tiptap-tag">#$1</span>`
        );
      }

      // 5. Création du post avec timeout étendu
      const post = await prisma.$transaction(
        async (tx) => {
          // Vérification de la catégorie
          const categoryExists = await tx.category.count({
            where: { id: categoryId },
          });
          if (!categoryExists) {
            throw new Error("Catégorie non trouvée.");
          }

          // Création du post
          return await tx.post.create({
            data: {
              title,
              searchableTitle: removeAccents(title),
              slug,
              content: formattedContent,
              authorId: session.user.id,
              categoryId,
              featuredImage: featuredImagePath,
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
          maxWait: 10000, // Temps max d'attente (10s)
          timeout: 10000, // Timeout de la transaction (10s)
        }
      );

      return NextResponse.json(
        { message: "Article créé avec succès.", post },
        { status: 201 }
      );
    } catch (error) {
      // Nettoyage de l'image en cas d'erreur
      await deleteFileFromVercelBlob(featuredImagePath).catch(console.error);
      throw error;
    }
  } catch (error) {
    console.error("Erreur création article:", error);

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
