import { requireRole } from "@/lib/middlewares/require-role";
import { prisma } from "@/lib/prisma";
import { removeAccents } from "@/utils/user-utils";
import { NextRequest, NextResponse } from "next/server";
const protectedAccounts = process.env.PROTECTED_ACCOUNTS?.split(",") || [];

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function DELETE(req: NextRequest) {
  const notAllowed = await requireRole("ADMIN");
  if (notAllowed) return notAllowed;

  const data = await req.json();
  const userIds = data.userIds;

  if (!Array.isArray(userIds)) {
    return NextResponse.json(
      {
        message: "Le corps de la requête doit contenir un tableau 'userIds'.",
      },
      { status: 400 }
    );
  }

  if (userIds.length === 0) {
    return NextResponse.json(
      {
        message: "Aucun identifiant d'utilisateur fourni.",
      },
      { status: 400 }
    );
  }

  // Validation des IDs
  const invalidIds = userIds.filter(
    (id: string) => typeof id !== "string" || !id.trim()
  );
  if (invalidIds.length > 0) {
    return NextResponse.json(
      {
        message: `IDs invalides: ${invalidIds.join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const deactivatedUsers: unknown[] = [];
    const protectedUsers: unknown[] = [];

    await prisma.$transaction(async (tx) => {
      for (const id of userIds) {
        const user = await tx.user.findFirst({
          where: {
            id,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

        if (!user) continue;

        // Vérifier si le compte est protégé
        if (
          protectedAccounts.some(
            (entry: unknown) =>
              typeof entry === "string" && user.email.includes(entry as string)
          ) ||
          protectedAccounts.some((protectedName) =>
            removeAccents(user.name ?? "").includes(protectedName.toLowerCase())
          )
        ) {
          protectedUsers.push({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          });
          continue;
        }

        // Désactiver l'utilisateur (soft delete)
        await tx.user.update({
          where: { id },
          data: { isActive: false },
        });

        deactivatedUsers.push({
          id: user.id,
          name: user.name,
          role: user.role,
        });
      }
    });

    if (deactivatedUsers.length === 0 && protectedUsers.length === 0) {
      return NextResponse.json(
        {
          message: `Aucun utilisateur actif trouvé avec les identifiants fournis.`,
        },
        { status: 400 }
      );
    }

    let responseMessage = "";

    if (deactivatedUsers.length > 0) {
      const userCount = deactivatedUsers.length;
      const userNames = deactivatedUsers
        .map((u: unknown) => {
          const user = u as { name: string; role: string };
          return `${user.name} (${user.role})`;
        })
        .join(", ");

      responseMessage += `${userCount} utilisateur${
        userCount > 1 ? "s" : ""
      } désactivé${userCount > 1 ? "s" : ""}: ${userNames}`;
    }

    if (protectedUsers.length > 0) {
      if (responseMessage) responseMessage += ". ";

      const protectedCount = protectedUsers.length;
      const protectedNames = protectedUsers
        .map((u: unknown) => {
          const user = u as { name: string; email: string };
          return `${user.name} (${user.email})`;
        })
        .join(", ");

      responseMessage += `${protectedCount} utilisateur${
        protectedCount > 1 ? "s" : ""
      } protégé${protectedCount > 1 ? "s" : ""} non désactivé${
        protectedCount > 1 ? "s" : ""
      }: ${protectedNames}`;
    }

    console.log("Résultat de la désactivation:", responseMessage);

    // return res.status(200).json({
    //   message: responseMessage,
    //   deactivatedUsers,
    //   protectedUsers: protectedUsers.length > 0 ? protectedUsers : undefined,
    // });
    return NextResponse.json(
      {
        message: responseMessage,
        deactivatedUsers,
        protectedUsers: protectedUsers.length > 0 ? protectedUsers : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la désactivation des utilisateurs.",
      },
      { status: 500 }
    );
  }
}
