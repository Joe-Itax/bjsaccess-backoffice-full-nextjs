"use client";

import { useAuthRedirect } from "@/hooks/use-auth-redirect";

export function UserState() {
  useAuthRedirect({
    ifUnauthenticated: "/login",
  });

  return null;
}
