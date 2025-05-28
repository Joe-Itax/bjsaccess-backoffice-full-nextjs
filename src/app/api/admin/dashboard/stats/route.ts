import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Optimisation des requêtes Prisma
    const stats = await getDashboardStats();

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[DASHBOARD_STATS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(startOfMonth.getTime() - 1);
  const threeMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 3));

  // Toutes les requêtes en parallèle
  const [counts, postsLastMonth, postsGroup, commentsGroup, popularPosts] =
    await Promise.all([
      // Counts de base
      prisma.$transaction([
        prisma.post.count(),
        prisma.post.count({ where: { published: true } }),
        prisma.post.count({
          where: { createdAt: { gte: startOfMonth }, published: true },
        }),
        prisma.comment.count(),
        prisma.comment.count({ where: { isApproved: true } }),
        prisma.comment.count({
          where: { createdAt: { gte: startOfMonth }, isApproved: true },
        }),
        prisma.category.count(),
        prisma.tag.count(),
      ]),

      // Posts du mois dernier
      prisma.post.count({
        where: {
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          published: true,
        },
      }),

      // Données pour les graphiques - Posts
      prisma.post.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: threeMonthsAgo } },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),

      // Données pour les graphiques - Commentaires
      prisma.comment.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: threeMonthsAgo }, isApproved: true },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),

      // Posts populaires
      prisma.post.findMany({
        where: { published: true },
        select: {
          id: true,
          title: true,
          slug: true,
          _count: { select: { comments: true } },
        },
        orderBy: { comments: { _count: "desc" } },
        take: 5,
      }),
    ]);

  // Destructuration des counts
  const [
    totalPosts,
    publishedPosts,
    newPostsThisMonth,
    totalComments,
    approvedComments,
    newCommentsThisMonth,
    totalCategories,
    totalTags,
  ] = counts;

  // Calcul des taux
  const postsGrowthRate =
    postsLastMonth === 0
      ? newPostsThisMonth > 0
        ? 100
        : 0
      : Math.round(
          ((newPostsThisMonth - postsLastMonth) / postsLastMonth) * 100
        );

  const approvalRate =
    totalComments === 0
      ? 0
      : Math.round((approvedComments / totalComments) * 100);

  // Préparation des données combinées
  const dateMap = new Map<string, { posts: number; comments: number }>();

  const processData = (
    items: { createdAt: Date }[],
    type: "posts" | "comments"
  ) => {
    items.forEach((item) => {
      const dateKey = item.createdAt.toISOString().split("T")[0];
      const data = dateMap.get(dateKey) || { posts: 0, comments: 0 };
      dateMap.set(dateKey, {
        ...data,
        [type]: data[type] + 1, // Simplifié car _count est toujours 1 dans groupBy
      });
    });
  };

  processData(postsGroup, "posts");
  processData(commentsGroup, "comments");

  // Remplissage des dates manquantes
  const chartData = [];
  const currentDate = new Date(threeMonthsAgo);

  while (currentDate <= now) {
    const dateKey = currentDate.toISOString().split("T")[0];
    const data = dateMap.get(dateKey) || { posts: 0, comments: 0 };

    chartData.push({
      date: new Date(dateKey),
      posts: data.posts,
      comments: data.comments,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    totalPosts,
    publishedPosts,
    draftPosts: totalPosts - publishedPosts,
    newPostsThisMonth,
    totalComments,
    approvedComments,
    pendingComments: totalComments - approvedComments,
    newCommentsThisMonth,
    totalCategories,
    totalTags,
    postsGrowthRate,
    approvalRate,
    charts: chartData,
    popularPosts: popularPosts.map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      commentsCount: post._count.comments,
    })),
  };
}
