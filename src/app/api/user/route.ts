import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handleUpload } from "@/lib/middlewares/upload-file";
import { requireRole } from "@/lib/middlewares/require-role";
import { removeAccents } from "@/utils/user-utils";
import { paginationQuery } from "@/utils/pagination";
import { slugify } from "@/utils/generate-unique-slug";

export const config = {
  api: {
    bodyParser: false,
  },
};

// -------- GET: Get Users --------
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");

    const users = await paginationQuery(prisma.user, page, limit);
    return NextResponse.json(users);
  } catch (error) {
    console.error("Erreur GET /api/users", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}

// -------- POST: Admin crée un user --------
export async function POST(req: Request) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const body = await req.json();
  const password = body.password
    ? body.password
    : process.env.DEFAULT_PASSWORD_USER;
  try {
    const newUser = await auth.api.signUpEmail({
      headers: await headers(),
      body: {
        email: body.email,
        password,
        name: body.name,
        role: body.role ?? "AUTHOR",
      },
    });

    console.log("Nouvel utilisateur", newUser);
    return NextResponse.json(newUser);
  } catch (error) {
    console.error("Erreur POST /api/user", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Erreur serveur",
      },
      {
        status: 500,
      }
    );
  }
}

// -------- PUT: Update Profile or Admin Update --------

export async function PUT(req: NextRequest) {
  const contentType = req.headers.get("content-type");
  const formData = await req.formData();

  const session = await auth.api.getSession({ headers: await headers() });
  const currentUser = session?.user;

  if (!currentUser)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    if (contentType?.includes("multipart/form-data")) {
      const name = formData.get("name") as string;
      const newEmail = formData.get("email") as string;
      const file = formData.get("avatar") as Blob | null;
      const currentPassword = formData.get("currentPassword") as string;
      const newPassword = formData.get("newPassword") as string;

      // Avatar
      if (file && file.size > 0) {
        const imagePath = await handleUpload({
          file,
          folder: "avatars",
          filenamePrefix: `avatar-${currentUser.id}-${slugify(name)}`,
        });
        await auth.api.updateUser({
          body: { image: imagePath },
          headers: await headers(),
        });
      }

      // Nom
      if (name && name !== currentUser.name) {
        const searchableName = removeAccents(name);
        await auth.api.updateUser({
          body: { name, searchableName },
          headers: await headers(),
        });
      }

      // Email
      if (newEmail && newEmail !== currentUser.email) {
        await auth.api.changeEmail({
          body: { newEmail },
          headers: await headers(),
        });
      }

      // Mot de passe
      if (newPassword && currentPassword) {
        await auth.api.changePassword({
          body: {
            newPassword,
            currentPassword,
            revokeOtherSessions: true,
          },
          headers: await headers(),
        });
      }

      // Reactivate User By Admin
      const userId = formData.get("userId") as string;
      if (userId) {
        const notAllowed = await requireRole("ADMIN");
        try {
          if (notAllowed) return notAllowed;
          console.log("user allowed");
          await prisma.user.update({
            where: { id: userId },
            data: { isActive: true },
          });
          return NextResponse.json({
            message: "Utilisateur réactiver avec succès.",
          });
        } catch (error) {
          return NextResponse.json(
            {
              error: error instanceof Error ? error.message : "Erreur serveur",
            },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        message: "Votre profil a été mis à jour avec succès.",
      });
    }

    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  } catch (error) {
    console.log("Erreur PUT /api/user", error);
    console.error("Erreur PUT /api/user", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
