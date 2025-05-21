import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User } from "@/types/user";
import { useNotification } from "./use-notification";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface GetUsersResponse {
  totalItems: number;
  limitPerPage: number;
  totalPages: number;
  currentPage: number;
  data: User[];
}

// Récupérer tous les users
export function useUsersQuery() {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const query = useQuery<GetUsersResponse>({
    queryKey: ["users", pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      try {
        const res = await fetch(
          `/api/user?page=${pagination.pageIndex + 1}&limit=${
            pagination.pageSize
          }`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error(
            data.message || "Erreur lors du fetch des utilisateurs: ",
            data
          );
          throw new Error("Erreur lors du chargement des utilisateurs.");
        }
        return data;
      } catch (error) {
        console.error("Erreur lors du fetch des utilisateurs: ", error);
        throw error;
      }
    },
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const setPage = (pageIndex: number) => {
    setPagination((prev) => ({
      ...prev,
      pageIndex,
    }));
  };

  const setPageSize = (pageSize: number) => {
    setPagination((prev) => ({
      ...prev,
      pageSize,
    }));
  };

  return {
    ...query,
    pagination,
    setPage,
    setPageSize,
  };
}

// Récupérer un user par son id
export function useUserQuery(userId: string) {
  return useQuery<User>({
    queryKey: ["user", userId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/user/${userId}`);
        if (!res.ok) throw new Error("Erreur lors du fetch de l'utilisateur");
        const data = await res.json();

        return data.user;
      } catch (error) {
        console.error("Erreur lors du fetch de l'utilisateur: ", error);
        throw error;
      }
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// Ajouter un user
export function useAddUserMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Partial<User>) => {
      const res = await fetch(`/api/user`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Erreur lors de la création d'un utilisateur"
        );
      }
      return data;
    },
    onSuccess: (data) => {
      show("success", data.message || "Utilisateur ajouté avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      if (error.message === "User already exists") {
        show("note", "Utilisateur déjà existant");
      } else {
        show(
          "error",
          error.message || "Erreur lors de l'ajout de l'utilisateur"
        );
      }
    },
  });
}

// Désactiver un ou plusieurs utilisateurs
export function useDeactivateUserMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userIds: string[]) => {
      const res = await fetch(`/api/user/deactivate`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Échec de la désactivation");
      return data;
    },
    onSuccess: (data) => {
      show("note", data.message || "Utilisateurs désactivés avec succès");

      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      show("error", error.message || "Erreur lors de la désactivation");
    },
  });
}

// Supprimer définitivement un utilisateur (Et toutes les data lui rattaché)
export function useDeleteUserMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/user/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Échec de la suppression");
      }

      return await res.json();
    },
    onSuccess: (data, userId) => {
      show("success", data.message || "Utilisateur supprimé définitivement");

      // Invalider les requêtes affectées
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });

      router.push("/dashboard/users");

      // Si l'utilisateur supprimé est l'utilisateur courant
      if (
        (queryClient.getQueryData(["auth-user"]) as User | undefined)?.id ===
        userId
      ) {
        router.push("/login");
      }
    },
    onError: (error: Error) => {
      show("error", error.message || "Erreur lors de la suppression");
    },
  });
}

// Rechercher des users
export function useSearchUsersMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(`/api/user/search?q=${query}`);
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          `Erreur recherche d'utilisateurs. Erreur: `,
          data.message
        );
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["users"], data.data);
    },
  });
}

// Mettre à jour le current User
export function useUpdateUserMutation() {
  const { show } = useNotification();
  const { refetch: refetchCurrentUser } = authClient.useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/user`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      return res.json();
    },

    onSuccess: (data) => {
      refetchCurrentUser();
      show("success", data.message || "Utilisateur mis à jour avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
    },
    onError: (error) => {
      show(
        "error",
        error.message || "Erreur lors de la mise à jour de l'utilisateur"
      );
    },
  });
}
