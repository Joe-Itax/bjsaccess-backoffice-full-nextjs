"use client";

import Image from "next/image";
import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { LoginForm } from "@/components/login-form";
import { DashboardSkeleton } from "../dashboard/skeleton";
import { useAuthRedirect } from "@/hooks/use-auth-redirect";

export default function LoginPage() {
  const { isPending, user } = useAuthRedirect();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isPending) {
      // Ajout d'un délai de 3000ms (3s) après que isPending soit false
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 3000);

      return () => clearTimeout(timer); // Nettoyage du timer
    }
  }, [isPending]);

  // Afficher le skeleton tant que isPending est true OU que showContent est false
  if (isPending || !showContent) {
    return <DashboardSkeleton />;
  }

  // Si l'utilisateur est connecté, rediriger vers le dashboard
  if (user) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <LinkIcon className="size-4" />
            </div>
            BJS Access
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src={`/placeholder.svg`}
          alt="Image"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          width={800}
          height={1200}
        />
      </div>
    </div>
  );
}
