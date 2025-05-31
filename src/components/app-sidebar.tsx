"use client";

import * as React from "react";
import {
  // IconChartBar,
  IconDashboard,
  // IconFolder,
  // IconSettings,
  IconUsers,
  IconFileText,
  IconFolder,
  IconHash,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LinkIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Posts",
      url: "/dashboard/posts",
      icon: IconFileText,
    },
    {
      title: "Users",
      url: "/dashboard/users",
      icon: IconUsers,
    },
    {
      title: "Message",
      url: "/dashboard/message",
      icon: IconHash,
    },
    {
      title: "Categories",
      url: "/dashboard/categories",
      icon: IconFolder,
    },
  ],
  navSecondary: [
    // {
    //   title: "Paramètres",
    //   url: "",
    //   icon: IconSettings,
    // },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session, error, refetch } = authClient.useSession();
  const user = session?.user;

  React.useEffect(() => {
    if (error) {
      console.error(error);
      refetch();
    }
  }, [error, refetch]);

  return (
    <Sidebar collapsible="icon" {...props} variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div>
                <LinkIcon className="!size-6" />
                <span className="text-base font-semibold">BJS Access</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {!user ? (
          <div className="flex justify-center items-center">
            <div className="size-5 animate-spin rounded-full border-4 border-primary border-t-white"></div>
          </div>
        ) : (
          <NavUser user={user} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
