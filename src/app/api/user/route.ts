import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handleUpload, slugify } from "@/lib/middlewares/upload-file";
import { requireRole } from "@/lib/middlewares/require-role";
import { removeAccents } from "@/utils/user-utils";
import { paginationQuery } from "@/utils/pagination";

export const config = {
  api: {
    bodyParser: false,
  },
};

// -------- GET: Get Users --------
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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

  const session = await auth.api.getSession({ headers: await headers() });
  const currentUser = session?.user;

  if (!currentUser)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    if (contentType?.includes("multipart/form-data")) {
      const formData = await req.formData();
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

      return NextResponse.json({
        message: "Votre profil a été mis à jour avec succès.",
      });
    }

    // ADMIN update: role & isActive
    if (contentType?.includes("application/json")) {
      const body = await req.json();
      const { userId, role, isActive } = body;

      // Vérifie si l'utilisateur est un ADMIN
      if (currentUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
      }

      if (!userId) {
        return NextResponse.json({ error: "userId requis" }, { status: 400 });
      }

      // Update ciblé (role / isActive)
      await auth.api.updateUser({
        body: {
          id: userId,
          ...(role && { role }),
          ...(typeof isActive === "boolean" && { isActive }),
        },
        headers: await headers(),
      });

      return NextResponse.json({ message: "Utilisateur mis à jour" });
    }

    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  } catch (error) {
    console.log("Erreur PUT /api/user", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}

// -------- PATCH: Activer / désactiver un user --------
export async function PATCH(req: Request) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const body = await req.json();

  const updated = await prisma.user.update({
    where: { id: body.id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json(updated);
}

// -------- DELETE: Supprimer un user --------
export async function DELETE(req: Request) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "Utilisateur supprimé" });
}
