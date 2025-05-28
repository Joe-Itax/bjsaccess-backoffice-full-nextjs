import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis;

const prisma =
  (globalForPrisma as unknown as { prisma: PrismaClient | undefined }).prisma ||
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  (globalForPrisma as unknown as { prisma: PrismaClient | undefined }).prisma =
    prisma;
}

export { prisma, Prisma };
