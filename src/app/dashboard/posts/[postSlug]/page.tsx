"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarIcon,
  CheckCircleIcon,
  CircleOffIcon,
  MoveLeftIcon,
  PencilLineIcon,
  UserIcon,
} from "lucide-react";
import { IconDotsVertical } from "@tabler/icons-react";

import {
  useDeleteCommentMutation,
  useModerateCommentMutation,
  usePostByIdQuery,
  usePublishPostMutation,
} from "@/hooks/use-posts";
import { Comment } from "@/types/posts";
import { Button } from "@/components/ui/button";
import DataStatusDisplay from "../../components/data-status-display";
import DeletePost from "../../components/delete-post";

// --- Tiptap Node Styles (from simple-editor.tsx) ---
import "@/styles/tiptap-content-render.scss";

export default function PostDetailsPage() {
  const { postSlug } = useParams();
  const router = useRouter();

  const { data, isPending, isError, error, refetch } = usePostByIdQuery(
    postSlug as string
  );
  const post = data?.post;

  const publishPostMutation = usePublishPostMutation();

  const publishPost = async () => {
    try {
      await publishPostMutation.mutateAsync({
        id: post.slug,
        published: !post.published,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (isError || !post || isPending) {
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
      <div className="mx-auto sm:w-5/6 w-full">
        <div className="w-full space-y-6">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/dashboard/posts`)}
            >
              <MoveLeftIcon />
            </Button>
            <h2 className={`text-2xl font-bold px-2`}>{post.title}</h2>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-4 text-gray-500 text-sm my-4">
            <div className="flex">
              <UserIcon className="text-blue-500 mr-1" size={25} />{" "}
              <h3 className="text-lg font-semibold">
                Créer par <span>{post.author.name}</span>
              </h3>
            </div>
            <div className="flex">
              <CalendarIcon className="text-blue-500 mr-1" size={25} />
              <h3 className="text-lg font-semibold">
                <span>Date de création: {formatDate(post.createdAt)}</span>
              </h3>
            </div>
            <div className="flex">
              <CalendarIcon className="text-blue-500 mr-1" size={25} />
              <h3 className="text-lg font-semibold">
                <span>Dernière mise à jour: {formatDate(post.updatedAt)}</span>
              </h3>
            </div>
            <div className="flex">
              {post.published ? (
                <CheckCircleIcon className="text-blue-500 mr-1" size={25} />
              ) : (
                <CircleOffIcon className="text-red-500 mr-1" size={25} />
              )}
              <h3 className="text-lg font-semibold">
                Status: <span>{post.published ? "Publié" : "Non publié"}</span>
              </h3>
              {post.published ? (
                <Button
                  size={"sm"}
                  className="ml-3"
                  disabled={publishPostMutation.isPending}
                  onClick={publishPost}
                >
                  {publishPostMutation.isPending ? "En cours..." : "Retirer"}
                </Button>
              ) : (
                <Button
                  size={"sm"}
                  className="ml-3"
                  disabled={publishPostMutation.isPending}
                  onClick={publishPost}
                >
                  {publishPostMutation.isPending ? "En cours..." : "Publier"}
                </Button>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold">Actions</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/dashboard/posts/${post.slug}/edit`)
                }
              >
                <PencilLineIcon className="mr-2 h-4 w-4" />
                Modifier
              </Button>
              <DeletePost post={post} />
            </div>
            <div></div>
          </div>
        </div>

        <div className="flex flex-col gap-6 items-center w-full py-6">
          <div className="absolute top-8 left-0 z-20">
            <span className="inline-block bg-primary px-3.5 py-2.5 text-sm font-semibold text-white">
              {post.category.name}
            </span>
          </div>
          <div className="w-full h-96 overflow-hidden">
            <Image
              src={`${post.featuredImage}`}
              width={800}
              height={400}
              alt={post.title}
              className="size-full object-cover"
            />
          </div>

          <div className="w-full">
            <h1 className="text-4xl font-bold">{post.title}</h1>
          </div>
          <div className="w-full">
            <div
              className="post-content-container"
              dangerouslySetInnerHTML={{ __html: post.content }}
            ></div>
          </div>
        </div>

        {/* Comments comments	 */}
        <div className="py-4">
          <h2 className="text-lg font-semibold border-b">
            {post.comments.length} Commentaire
            {post.comments.length > 1 ? "s" : ""}
          </h2>
          <div className="flex flex-col gap-4 py-4">
            {post.comments.map((comment: Comment) => (
              <div key={comment.id} className="flex flex-col gap-0">
                <div>
                  <h3 className="text-lg flex items-center gap-2">
                    <span className="font-medium text-primary">
                      {comment.visitorName}
                    </span>
                    {" - "}
                    <span className="font-medium text-primary">
                      {comment.visitorEmail}
                    </span>
                    {" - "}
                    <span className="italic text-black font-light">
                      {formatDate(comment.createdAt)}
                    </span>
                    {comment.isApproved ? (
                      <CheckCircleIcon
                        className="text-blue-500 mr-1"
                        size={20}
                      />
                    ) : (
                      <CircleOffIcon className="text-red-500 mr-1" size={20} />
                    )}
                    <CommentMenu comment={comment} />
                  </h3>
                </div>
                <div>
                  <p className="text-gray-600">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommentMenu({ comment }: { comment: Comment }) {
  const moderateCommentMutation = useModerateCommentMutation();
  const deleteCommentMutation = useDeleteCommentMutation();

  const moderateComment = async () => {
    try {
      await moderateCommentMutation.mutateAsync({
        postId: comment.postId,
        commentId: comment.id,
        action: comment.isApproved ? "reject" : "approve",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteComment = async () => {
    try {
      await deleteCommentMutation.mutateAsync({
        postId: comment.postId,
        commentId: comment.id,
      });
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={"sm"}>
          <IconDotsVertical className="ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={moderateComment}>
            {comment.isApproved ? "Rejeter" : "Approver"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={deleteComment}
            className="bg-red-500 text-white focus:bg-red-600 focus:text-white transition-all"
          >
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
