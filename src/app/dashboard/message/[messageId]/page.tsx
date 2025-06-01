"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoveLeftIcon } from "lucide-react";
import { IconDotsVertical } from "@tabler/icons-react";

import DataStatusDisplay from "../../components/data-status-display";
import {
  useDeleteMessageMutation,
  useMarkOneMessageAsReadMutation,
  useMessageQuery,
} from "@/hooks/use-message";
import { formatDate } from "@/utils/format-date";

import { Button } from "@/components/ui/button";
import { ContactMessage } from "@/types/message";
import Spinner from "@/components/spinner";

export default function MessageDetailPage() {
  const { messageId } = useParams();
  const router = useRouter();
  const {
    data,
    isPending: isPendingMessage,
    isError,
    error,
    refetch,
  } = useMessageQuery(messageId as string);
  const message = data;
  const { mutateAsync: markMessageAsRead } = useMarkOneMessageAsReadMutation();

  const [hoverBox, setHoverBox] = useState(false);

  const handleHover = () => {
    setHoverBox(!hoverBox);
  };

  const handleMarkMessageAsRead = useCallback(async () => {
    try {
      if (message && !message.isRead) {
        await markMessageAsRead({ messageId: message.id });
      }
    } catch (error) {
      console.error("Erreur lors du marquage du message comme lu: ", error);
    }
  }, [message, markMessageAsRead]);

  useEffect(() => {
    if (message && !message.isRead) {
      handleMarkMessageAsRead();
    }
  }, [message, handleMarkMessageAsRead]);

  if (isError || isPendingMessage || !message) {
    return (
      <DataStatusDisplay
        isPending={isPendingMessage}
        hasError={isError}
        errorObject={error}
        refetch={refetch}
      />
    );
  }

  return (
    <section className="py-4 px-2 size-full container max-w-[55rem] mx-auto flex flex-col gap-8">
      <div className="mx-auto sm:w-5/6 w-full">
        <div className="w-full space-y-6 py-8">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/dashboard/message`)}
            >
              <MoveLeftIcon />
            </Button>
            <h2 className={`text-xl px-2`}>
              Message de{" "}
              <span className={`text-xl font-bold px-2`}>{message.name}</span>
            </h2>
          </div>
        </div>
        <div
          className="size-full rounded shadow-lg bg-white hover:shadow-xl transition-shadow duration-300 relative p-4 flex gap-2 justify-between items-center"
          onMouseEnter={handleHover}
          onMouseLeave={handleHover}
        >
          <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between">
              <div>
                <p className="font-bold text-gray-800 text-[18px]">
                  {message.name}
                </p>
                <Link
                  href={`mailto:${message.email}`}
                  target="_blank"
                  className="text-gray-800 text-[15px]"
                >
                  {message.email}
                </Link>
              </div>
              <div className="flex flex-col items-end">
                <p className={`${message.isRead ? "" : ""}`}>
                  {formatDate(message.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div>
                  <p className="font-semibold">{message.subject}</p>
                </div>
                <div>
                  {" "}
                  <p className="">{message.message}</p>
                </div>
              </div>
              <div className="w-16 flex justify-end items-end">
                {/* <Button variant={"outline"} size={"icon"}>
                  <IconDotsVertical />
                </Button> */}
                <MessageMenu message={message} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageMenu({ message }: { message: ContactMessage }) {
  const router = useRouter();
  const { mutateAsync: deleteMessageMutation, isPending } =
    useDeleteMessageMutation();

  const deleteMessage = async () => {
    try {
      await deleteMessageMutation({
        messageId: message.id,
      });
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={"icon"}>
          <IconDotsVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(`mailto:${message.email}`)}
          >
            Répondre par mail
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={deleteMessage}
            className="bg-red-500 text-white focus:bg-red-600 focus:text-white transition-all"
          >
            {isPending ? "En cours" : "Supprimer"}
            {isPending && <Spinner />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
