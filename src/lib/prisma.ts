import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma =
  (globalForPrisma as unknown as { prisma: PrismaClient | undefined }).prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  (globalForPrisma as unknown as { prisma: PrismaClient | undefined }).prisma =
    prisma;
}

export { prisma, Prisma };
