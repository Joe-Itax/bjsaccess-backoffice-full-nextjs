"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// import { useState } from "react";
import { useNotification } from "@/hooks/use-notification";
import { Category, Post, Tag } from "@/types/posts";
import { useRouter } from "next/navigation";

export function usePostsQuery() {
  const { show } = useNotification();
  return useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts`,
          {
            credentials: "include",
          }
        );
        if (!res.ok) {
          show("error", "Erreur lors du chargement des articles.");
          throw new Error("Erreur récupération des articles");
        }
        const data = await res.json();
        return data.data;
      } catch (error) {
        console.error("Erreur lors du chargement des articles: ", error);
        throw error;
      }
    },
  });
}

export function useSearchPostsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/search?q=${query}`,
        {
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Erreur recherche des articles");
      const data = await res.json();
      return data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["posts"], data);
    },
  });
}

export function usePostByIdQuery(id: string) {
  return useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/${id}`,
        {
          credentials: "include",
        }
      );
      if (!res.ok) throw new Error("Erreur récupération de l'article");
      const data = await res.json();
      return data;
    },
  });
}

export function usePostByCategoryQuery(slug: string) {
  return useQuery({
    queryKey: ["posts", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/category/${slug}`,
        {
          credentials: "include",
        }
      );
      if (!res.ok)
        throw new Error("Erreur récupération des articles de cette catégorie");
      const data = await res.json();
      return data;
    },
  });
}

export function usePostByTagsQuery(slug: string) {
  return useQuery({
    queryKey: ["posts", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/tag/${slug}`,
        {
          credentials: "include",
        }
      );
      if (!res.ok)
        throw new Error("Erreur récupération des articles de ces tags");
      const data = await res.json();
      return data;
    },
  });
}

export function useCreatePostMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: FormData) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin`,
        {
          method: "POST",
          credentials: "include",
          body: post,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Erreur lors de la création de l'article"
        );
      }
      return data;
    },
    onSuccess: (data) => {
      show("success", data.message || "Article créer avec succès");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      show("error", error.message || "Erreur lors de la création de l'article");
    },
  });
}

export function useUpdatePostMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, form }: { id: string; form: FormData }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin/${id}`,
        {
          method: "PUT",
          credentials: "include",
          body: form,
        }
      );

      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      return res.json();
    },

    onSuccess: (data) => {
      show("success", data.message || "Article mis à jour avec succès");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post"] });
    },
    onError: (error) => {
      show(
        "error",
        error.message || "Erreur lors de la mise à jour de l'article"
      );
    },
  });
}

export function usePublishPostMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: Partial<Post>) => {
      const { id, published } = post;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin/${id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ published }),
        }
      );
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      return res.json();
    },

    onSuccess: (data) => {
      if (data.post.published) {
        show("success", "Article publié !");
      } else {
        show("note", "Article retiré de la publication!");
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post"] });
    },
    onError: (error) => {
      show(
        "error",
        error.message || "Erreur lors de la publication de l'article"
      );
    },
  });
}

export function useDeletePostMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin/${postId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la suppression");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      show("success", data.message || "Article supprimé définitivement");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["posts"] });

      router.push("/dashboard/posts");
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la suppression");
    },
  });
}

export function useDeleteCommentMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      commentId,
    }: {
      postId: string;
      commentId: string;
    }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin/${postId}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la suppression");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      show("success", data.message || "Commentaire supprimé");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["post"] });
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la suppression");
    },
  });
}

export function useModerateCommentMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      commentId,
      action,
    }: {
      postId: string;
      commentId: string;
      action: string;
    }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/posts/admin/${postId}/comments/${commentId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la moderation");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      show("success", data.message || "Commentaire moderé");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["post"] });
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la moderation");
    },
  });
}

// Category
export function useCategoriesQuery() {
  const { show } = useNotification();
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/post/category`, {
          credentials: "include",
        });
        if (!res.ok) {
          show("error", "Erreur lors du chargement des categories.");
          throw new Error("Erreur récupération des categories");
        }
        const data = await res.json();
        // console.log("categories data: ", data);
        return data.data;
      } catch (error) {
        console.error("Erreur lors du chargement des categories: ", error);
        throw error;
      }
    },
  });
}

export function useCreateCategoryMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: Partial<Category>) => {
      const res = await fetch(`/api/post/category`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(category),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Erreur lors de la création de la catégorie"
        );
      }
      return data;
    },
    onSuccess: (data) => {
      show("success", data.message || "Catégorie créer avec succès");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error) => {
      show(
        "error",
        error.message || "Erreur lors de la création de la catégorie"
      );
    },
  });
}

export function useDeleteCategoryMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string }) => {
      const res = await fetch(`/api/post/category/${categoryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la suppression");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      show("success", data.message || "Categorie supprimé");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la suppression");
    },
  });
}

// Tags
export function useTagsQuery() {
  const { show } = useNotification();
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/admin/tag`, {
          credentials: "include",
        });
        if (!res.ok) {
          show("error", "Erreur lors du chargement des tags.");
          throw new Error("Erreur récupération des tags");
        }
        const data = await res.json();
        return data.data;
      } catch (error) {
        console.error("Erreur lors du chargement des tags: ", error);
        throw error;
      }
    },
  });
}
export function useCreateTagMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tag: Partial<Tag>) => {
      const res = await fetch(`/api/admin/tag`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tag),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de la création du Tag");
      }
      return data;
    },
    onSuccess: (data) => {
      show("success", data.message || "Tag créer avec succès");
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error) => {
      show("error", error.message || "Erreur lors de la création du Tag");
    },
  });
}

export function useDeleteTagMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tagId }: { tagId: string }) => {
      const res = await fetch(`/api/admin/tag/${tagId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la suppression");
      }

      return await res.json();
    },
    onSuccess: (data) => {
      show("success", data.message || "Tag supprimé");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la suppression");
    },
  });
}
