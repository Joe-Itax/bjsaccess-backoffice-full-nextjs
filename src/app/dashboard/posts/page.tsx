"use client";

import {
  // useCategoriesQuery,
  usePostsQuery,
  // useTagsQuery,
} from "@/hooks/use-posts";
import PostCard from "../components/post-card";
import { Post } from "@/types/posts";
// import CreatePost from "../components/create-post";
import Spinner from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
// import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PostsPage() {
  const { data: posts, isPending, isError, refetch } = usePostsQuery();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="w-full py-64 flex justify-center items-center">
        <div className="flex gap-4 items-center">
          Chargement... <Spinner />
        </div>
      </div>
    );
  }

  if (isError) {
    refetch();
  }

  return (
    <section className="container size-full mx-auto flex justify-center">
      <div className=" px-2 md:p-8 sm:px-4">
        <div>
          <Button
            className="ml-auto"
            variant="outline"
            onClick={() => router.push("/dashboard/posts/create")}
          >
            <PlusIcon className="-ms-1 opacity-60" size={16} />
            Ajouter un post
          </Button>
        </div>
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 place-items-center gap-4 py-4">
            {posts.map((post: Post) => (
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
