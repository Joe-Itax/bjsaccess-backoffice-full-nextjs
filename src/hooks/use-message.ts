import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotification } from "./use-notification";
import { useState } from "react";
import { ContactMessage } from "@/types/message";

interface GetMessagesResponse {
  totalItems: number;
  limitPerPage: number;
  totalPages: number;
  currentPage: number;
  data: ContactMessage[];
}

// Récupérer tous les messages
export function useMessagesQuery() {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const query = useQuery<GetMessagesResponse>({
    queryKey: ["messages", pagination.pageIndex, pagination.pageSize],
    queryFn: async () => {
      try {
        const res = await fetch(
          `/api/contact?page=${pagination.pageIndex + 1}&limit=${
            pagination.pageSize
          }`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.message || "Erreur lors du chargement des messages."
          );
        }
        return data;
      } catch (error) {
        console.error("Erreur lors du fetch des messages: ", error);
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

// Récupérer un message par son id
export function useMessageQuery(messageId: string) {
  return useQuery<ContactMessage>({
    queryKey: ["message", messageId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/contact/${messageId}`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.message || "Erreur lors du fetch du message");

        return data;
      } catch (error) {
        console.error("Erreur lors du fetch du message: ", error);
        throw error;
      }
    },
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMarkAllMessagesAsReadMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contact`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Erreur marquage messages");
      return res.json();
    },
    onSuccess: () => {
      show("success", "Messages marqués comme étant lues !");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => {
      show("error", "Erreur lors du marquage des messages.");
    },
  });
}

export function useMarkOneMessageAsReadMutation() {
  const { show } = useNotification();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      const res = await fetch(`/api/contact/${messageId}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Erreur marquage message");
      return res.json();
    },
    onSuccess: () => {
      //   show("success", "Message marqué comme étant lue !");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["message"] });
    },
    onError: () => {
      show("error", "Erreur lors du marquage du message.");
    },
  });
}
