"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function useAuthRedirect({
  ifAuthenticated,
  ifUnauthenticated,
}: {
  ifAuthenticated?: string;
  ifUnauthenticated?: string;
} = {}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    if (isPending) return;

    if (user && ifAuthenticated) {
      router.replace(ifAuthenticated);
    }

    if (!user && ifUnauthenticated) {
      router.replace(ifUnauthenticated);
    }
  }, [user, isPending, ifAuthenticated, ifUnauthenticated, router]);

  return { user, isPending };
}
