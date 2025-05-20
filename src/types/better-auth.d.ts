import "better-auth";

declare module "better-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null;

    role: "ADMIN" | "AUTHOR";
    searchableName?: string;
    isActive: boolean;
  }
}
