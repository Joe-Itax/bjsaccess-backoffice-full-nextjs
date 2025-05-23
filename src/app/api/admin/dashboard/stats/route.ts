import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const config = {
  api: {
    bodyParser: false,
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(startOfMonth.getTime() - 1);
    const threeMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 3));

    // Helper function to format dates for grouping.
    const formatDateForComparison = (date: Date): string => {
      const d = new Date(date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate())
        .toISOString()
        .split("T")[0];
    };

    // Execute all Prisma queries in parallel using Promise.all
    const [
      totalPosts,
      publishedPosts,
      newPostsThisMonth,
      totalComments,
      approvedComments,
      newCommentsThisMonth,
      totalCategories,
      totalTags,
      postsLastMonth,
      postsGroup,
      commentsGroup,
      popularPosts,
    ] = await Promise.all([
      // Basic Stats
      prisma.post.count(),
      prisma.post.count({ where: { published: true } }),
      prisma.post.count({
        where: {
          createdAt: { gte: startOfMonth },
          published: true,
        },
      }),
      prisma.comment.count(),
      prisma.comment.count({ where: { isApproved: true } }),
      prisma.comment.count({
        where: {
          createdAt: { gte: startOfMonth },
          isApproved: true,
        },
      }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.post.count({
        where: {
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
          published: true,
        },
      }),

      // Data for Charts - Posts by date
      prisma.post.groupBy({
        by: ["createdAt"],
        where: {
          createdAt: { gte: threeMonthsAgo },
          published: true,
        },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),

      // Data for Charts - Comments by date
      prisma.comment.groupBy({
        by: ["createdAt"],
        where: {
          createdAt: { gte: threeMonthsAgo },
          isApproved: true,
        },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),

      // Most Popular Posts
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

    // Calculate Rates
    const postsGrowthRate =
      postsLastMonth === 0
        ? newPostsThisMonth > 0
          ? 100
          : 0
        : ((newPostsThisMonth - postsLastMonth) / postsLastMonth) * 100;

    const approvalRate =
      totalComments === 0 ? 0 : (approvedComments / totalComments) * 100;

    // Prepare combined data for charts
    const combinedChartData: { date: Date; posts: number; comments: number }[] =
      [];
    const dateMap = new Map<string, { posts: number; comments: number }>();

    // Process posts
    postsGroup.forEach((post) => {
      const dateKey = formatDateForComparison(post.createdAt);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { posts: 0, comments: 0 });
      }
      dateMap.get(dateKey)!.posts += post._count.id; // Use non-null assertion as we just set it if not present
    });

    // Process comments
    commentsGroup.forEach((comment) => {
      const dateKey = formatDateForComparison(comment.createdAt);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { posts: 0, comments: 0 });
      }
      dateMap.get(dateKey)!.comments += comment._count.id; // Use non-null assertion
    });

    // Fill in dates with no activity
    const currentDate = new Date(threeMonthsAgo);
    while (currentDate <= now) {
      const dateKey = formatDateForComparison(currentDate);
      const data = dateMap.get(dateKey) || { posts: 0, comments: 0 };

      combinedChartData.push({
        date: new Date(dateKey), // Convert dateKey back to Date object
        posts: data.posts,
        comments: data.comments,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Format popular posts
    type PopularPostPayload = (typeof popularPosts)[number];

    const formattedPopularPosts = popularPosts.map(
      (post: PopularPostPayload) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        commentsCount: post._count.comments,
      })
    );

    return NextResponse.json(
      {
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
        postsGrowthRate: Math.round(postsGrowthRate),
        approvalRate: Math.round(approvalRate),
        charts: combinedChartData,
        popularPosts: formattedPopularPosts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching blog dashboard stats:", error);

    // Provide a more detailed error message in development if needed
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred while fetching dashboard stats.";

    return NextResponse.json(
      {
        message:
          "Erreur lors de la récupération des statistiques du tableau de bord",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
