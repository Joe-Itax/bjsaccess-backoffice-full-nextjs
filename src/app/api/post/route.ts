import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma, prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationQuery } from "@/utils/pagination";
import { generateUniqueSlug } from "@/utils/generate-unique-slug";

import { removeAccents } from "@/utils/user-utils";
import { handleUpload } from "@/lib/middlewares/upload-file";
import fs from "fs/promises";

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
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    // Handling file upload for featuredImage
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const categoryId = formData.get("categoryId") as string;
    const authorId = session?.user.id as string;
    // const tagsRaw = formData.get("tags") as string | null; // Tags can be comma-separated string or JSON array string
    const tagsRaw = formData.get("tags") as string | null; // This gets only the first 'tags' value if multiple are sent
    const allTagsRaw = formData.getAll("tags"); // Use this to get all values if 'tags' is sent multiple times

    let tagIds: string[] = [];

    // Prioritize parsing as a JSON array or from getAll, then fallback to single comma-separated string
    if (allTagsRaw.length > 1) {
      // If multiple 'tags' fields were sent (e.g., via multiple checkboxes)
      // tagIds = allTagsRaw.filter((id) => typeof id === "string");
      tagIds = allTagsRaw
        .map((id) => id.toString())
        .filter((id) => typeof id === "string");
    } else if (tagsRaw) {
      try {
        const parsedTags = JSON.parse(tagsRaw);
        if (Array.isArray(parsedTags)) {
          tagIds = parsedTags.filter((id) => typeof id === "string");
        } else if (typeof parsedTags === "string") {
          // Fallback for comma-separated string within a single field
          tagIds = parsedTags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
        }
      } catch (e) {
        console.error("Error parsing tags (attempting fallback):", e);
        // Fallback for non-JSON string if parsing fails (e.g., just a plain comma-separated string)
        tagIds = tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag);
      }
    }
    const featuredImageFile = formData.get("featuredImage") as Blob | null;

    // Reject extra fields - FormData needs explicit handling for this
    const allowedFields = new Set([
      "title",
      "content",
      "categoryId",
      "authorId",
      "tags",
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

    // Validation des champs obligatoires
    if (!title || !content || !categoryId || !featuredImageFile) {
      return NextResponse.json(
        {
          message: "Title, content, and category are required.",
          requiredFields: ["title", "content", "categoryId"],
        },
        { status: 400 }
      );
    }

    let featuredImagePath: string | null = null;
    let tempImagePath: string | null = null;

    try {
      const post = await prisma.$transaction(async (tx) => {
        const category = await tx.category.findUnique({
          where: { id: categoryId },
        });
        if (!category) {
          throw new Error("Categorie non trouvée.");
        }

        // Check if tags exist
        if (tagIds.length > 0) {
          const existingTags = await tx.tag.findMany({
            where: { id: { in: tagIds } },
          });
          if (existingTags.length !== tagIds.length) {
            throw new Error("Un ou plusieurs tag sont invalide.");
          }
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
              create: tagIds.map((tagId) => ({ tagId })),
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

        const prefix = `featured-${postCreated.id}-${postCreated.title}`;
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
        { message: "Article créée avec succès.", post },
        { status: 201 }
      );
    } catch (transactionError) {
      if (tempImagePath) {
        try {
          await fs.unlink(tempImagePath);
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
    }

    if (error instanceof Error) {
      if (
        error.message === "Categorie non trouvée." ||
        error.message === "Un ou plusieurs tag sont invalide."
      ) {
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
