"use client";

import { useParams, useRouter } from "next/navigation";
import { useUserQuery } from "@/hooks/use-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoveLeftIcon } from "lucide-react";
import DeleteUser from "../../components/delete-user";
import UpdateUserByAdmin from "../../components/update-user";
import PostCard from "../../components/post-card";
import DataStatusDisplay from "../../components/data-status-display";

export default function UserDetailsPage() {
  const { userId } = useParams();
  const router = useRouter();
  const {
    data: user,
    isPending,
    isError,
    error,
    refetch,
  } = useUserQuery(userId as string);

  if (isPending || isError) {
    return (
      <DataStatusDisplay
        isPending={isPending}
        hasError={isError}
        errorObject={error}
        refetch={refetch}
      />
    );
  }

  return (
    <section className="smp-6 py-4 px-2 size-full container max-w-[55rem] mx-auto flex flex-col gap-8">
      <div className="w-full space-y-6">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/users")}
          >
            <MoveLeftIcon />
          </Button>
          <h2
            className={`text-2xl font-bold px-2 ${
              !user.isActive ? "bg-red-400 rounded-sm" : ""
            }`}
          >
            Profil de {user.name}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold">Nom complet</h3>
            <p className="text-muted-foreground">{user.name}</p>
          </div>
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold">Adresse email</h3>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold">Rôle</h3>
            <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
              {user.role}
            </Badge>
          </div>
          <div className="bg-muted/20 rounded-lg p-4">
            <h3 className="font-semibold">Actions</h3>
            <div className="flex flex-wrap gap-2">
              <UpdateUserByAdmin user={user} />
              <DeleteUser user={user} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col size-full">
        <h3 className="text-xl font-semibold px-4 py-2">
          {user.postsCount} Post{user.postsCount > 1 && "s"} publié
          {user.postsCount > 1 && "s"}...
        </h3>
        {user.postsCount > 0 ? (
          <div className="grid lg:grid-cols-2 grid-cols-1 place-items-center gap-4 py-4">
            {user.posts.map((post) => (
              <div key={post.id} className="size-full flex justify-center">
                <PostCard post={post} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p>Aucun Post disponible</p>
          </div>
        )}
      </div>
    </section>
  );
}
