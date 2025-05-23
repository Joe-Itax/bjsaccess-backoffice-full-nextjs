import { DashboardStats } from "@/types/dashboard-stat";
import { useQuery } from "@tanstack/react-query";

export function useDashboardStatsQuery() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/admin/dashboard/stats`, {
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          //   console.error(data.message || "Erreur lors du fetch des stats.");
          throw new Error(data.message || "Erreur lors du fetch des stats.");
        }

        return data;
      } catch (error) {
        console.error(`Erreur lors du fetch des stats. Erreur: ${error}`);
      }
    },
    staleTime: 5 * 60 * 1000,
    // refetchOnWindowFocus: false,
  });
}
