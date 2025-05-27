"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { UserState } from "@/components/user-state";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSkeleton } from "./skeleton";
import { useAuthRedirect } from "@/hooks/use-auth-redirect";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending, user } = useAuthRedirect({ ifUnauthenticated: "/login" });
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isPending) {
      // Ajout d'un délai de 3000ms (3s) après que isPending soit false
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 500);

      return () => clearTimeout(timer); // Nettoyage du timer
    }
  }, [isPending]);

  // Afficher le skeleton tant que isPending est true OU que showContent est false
  if (isPending || !showContent) {
    return <DashboardSkeleton />;
  }

  // Si l'utilisateur est connecté, rediriger vers le dashboard
  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <UserState />
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-col size-full overflow-auto">
          <div className="@container/main flex flex-col gap-2">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
