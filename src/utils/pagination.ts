import { Prisma } from "@/lib/prisma";

/**
 * Interface for the pagination query options.
 */
interface PaginationOptions {
  where?: object; // Keep as object for general compatibility, or refine with Prisma.XWhereInput<...>
  orderBy?: Prisma.InputJsonValue | Prisma.Enumerable<unknown>; // More accurate for orderBy
  include?: Prisma.InputJsonValue; // You might want to use Prisma.XInclude (e.g., Prisma.UserInclude)
  select?: Prisma.InputJsonValue; // You might want to use Prisma.XSelect (e.g., Prisma.UserSelect)
  [key: string]: unknown; // Allows for other arbitrary options
}

/**
 * Interface for the structure of the paginated result.
 * @template T The type of the data being returned.
 */
interface PaginationResult<T> {
  totalItems: number;
  limitPerPage: number;
  totalPages: number;
  currentPage: number;
  data: T[];
  error?: string;
  details?: string;
}

interface PrismaDelegate<ModelType> {
  count(args?: { where?: object | Prisma.InputJsonValue }): Promise<number>;
  findMany(args: Prisma.Args<unknown, "findMany">): Promise<ModelType[]>;
}

/**
 * Performs a paginated query on a given Prisma model.
 *
 * @template T The type of the data being returned (e.g., User, Post).
 * @param {PrismaDelegate<T>} model The Prisma model delegate to query (e.g., prisma.user).
 * @param {number} [page=1] The current page number.
 * @param {number} [limit=10] The number of items per page.
 * @param {PaginationOptions} [options={}] Additional Prisma query options like 'where', 'orderBy', 'include'.
 * @returns {Promise<PaginationResult<T>>} A promise that resolves to the paginated result.
 */
export async function paginationQuery<T>(
  model: PrismaDelegate<T>,
  page: number = 1,
  limit: number = 10,
  options: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  try {
    page = Math.max(1, parseInt(String(page)) || 1);
    limit = Math.max(1, parseInt(String(limit)) || 10);
    const skip = (page - 1) * limit;

    if (
      !model ||
      typeof model.count !== "function" ||
      typeof model.findMany !== "function"
    ) {
      return {
        error: `Modèle invalide fourni à paginationQuery. Modèle: ${model}`,
        totalItems: 0,
        limitPerPage: limit,
        totalPages: 0,
        currentPage: page,
        data: [],
      };
    }

    const where = options.where || {};
    const totalItems = await model.count({ where });
    const totalPages = Math.ceil(totalItems / limit);

    if (page > totalPages && totalItems > 0) {
      return {
        error: `La page ${page} n'existe pas. Dernière page disponible : ${totalPages}.`,
        totalItems,
        limitPerPage: limit,
        totalPages,
        currentPage: page,
        data: [],
      };
    }

    const queryOptions: Prisma.Args<unknown, "findMany"> = {
      // Using `any` here is fine for the arguments to keep it generic
      skip,
      take: limit,
      where: options.where,
      orderBy: options.orderBy,
      include: options.include,
      select: options.select,
      ...options,
    };

    // The data type will be inferred correctly as T[] based on PrismaDelegate<T>
    const data = await model.findMany(queryOptions);

    return {
      totalItems,
      limitPerPage: limit,
      totalPages,
      currentPage: page,
      data,
    };
  } catch (error: unknown) {
    console.error("Erreur dans paginationQuery:", error);
    return {
      error: "Erreur lors de la pagination",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
      totalItems: 0,
      limitPerPage: limit,
      totalPages: 0,
      currentPage: page,
      data: [],
    };
  }
}

// --------------------------------------
