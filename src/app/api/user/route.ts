import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { handleUpload, slugify } from "@/lib/middlewares/upload-file";
import { requireRole } from "@/lib/middlewares/require-role";

export const config = {
  api: {
    bodyParser: false,
  },
};

// -------- PUT: Update Profile or Admin Update --------
export async function PUT(req: NextRequest) {
  const formData = await req.formData();
  const name = formData.get("name") as string;
  const newEmail = formData.get("email") as string;
  const file = formData.get("avatar") as Blob | null;
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  try {
    // Get Current Session
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const user = session?.user;

    const contentType = req.headers.get("content-type");

    if (!user)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (contentType?.includes("multipart/form-data")) {
      let imagePath;

      if (!user)
        return NextResponse.json(
          { error: "Utilisateur introuvable" },
          { status: 404 }
        );

      if (file && file.size > 0) {
        imagePath = await handleUpload({
          file,
          folder: "avatars",
          filenamePrefix: `avatar-${user.id}-${slugify(name)}`,
        });
        try {
          await auth.api.updateUser({
            body: {
              image: imagePath,
            },
            headers: await headers(),
          });
        } catch (error) {
          console.log("Erreur lors de la mise à jour de l'avatar", error);
        }
      }

      // Changement email
      if (name && name !== user.name) {
        try {
          await auth.api.updateUser({
            body: {
              name,
            },
            headers: await headers(),
          });
          return NextResponse.json({ message: "Nom modifié" });
        } catch (error) {
          console.log("Erreur lors de la mise à jour du nom", error);
        }
      }
    }

    // Changement email
    if (newEmail && newEmail !== user.email) {
      try {
        await auth.api.changeEmail({
          body: { newEmail: newEmail },
          headers: await headers(),
        });
        return NextResponse.json({ message: "Email modifié" });
      } catch (error) {
        console.log("Erreur lors de la mise à jour de l'email", error);
      }
    }

    // Changement password
    if (newPassword && currentPassword) {
      try {
        await auth.api.changePassword({
          body: {
            newPassword,
            currentPassword,
            revokeOtherSessions: true,
          },
          headers: await headers(),
        });
        return NextResponse.json({ message: "Mot de passe modifié" });
      } catch (error) {
        console.log("Erreur lors de la mise à jour du mot de passe", error);
      }
    }

    return NextResponse.json({
      message: "Votre profil a été mise à jour avec succès.",
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

// -------- POST: Admin crée un user --------
export async function POST(req: Request) {
  const notAllowed = await requireRole(req, "ADMIN");
  if (notAllowed) return notAllowed;

  const body = await req.json();
  const newUser = await auth.api.signUpEmail({
    body: {
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role ?? "AUTHOR",
    },
  });

  return NextResponse.json(newUser);
}

// -------- PATCH: Activer / désactiver un user --------
export async function PATCH(req: Request) {
  const notAllowed = await requireRole(req, "ADMIN");
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
  const notAllowed = await requireRole(req, "ADMIN");
  if (notAllowed) return notAllowed;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ message: "Utilisateur supprimé" });
}
