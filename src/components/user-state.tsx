"use client";

import { useAuthRedirect } from "@/hooks/use-auth-redirect";

export function UserState() {
  useAuthRedirect({
    ifAuthenticated: "/dashboard",
    ifUnauthenticated: "/login",
  });

  return null;
}
