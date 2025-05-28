import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "ADMIN",
      },
      searchableName: {
        type: "string",
        required: false,
        defaultValue: "",
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
    changeEmail: {
      enabled: true,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Vérifier si c'est la requête de connexion par email/mot de passe
      if (ctx.path !== "/sign-in/email") {
        return; // Ne rien faire pour les autres endpoints
      }

      const email = ctx.body?.email;

      if (!email || typeof email !== "string") {
        throw new APIError("BAD_REQUEST", {
          message: "Email manquant dans la requête.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: { isActive: true },
      });
      if (user && !user.isActive) {
        throw new APIError("UNAUTHORIZED", {
          code: "ACCOUNT_DEACTIVATED", // Code personnalisé
          message:
            "Votre compte est désactivé. Veuillez contacter l'administrateur.",
        });
      }

      return;
    }),
  },
});
