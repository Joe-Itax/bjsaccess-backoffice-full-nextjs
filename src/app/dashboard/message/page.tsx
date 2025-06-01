"use client";
import {
  useMarkAllMessagesAsReadMutation,
  useMessagesQuery,
} from "@/hooks/use-message";
import DataStatusDisplay from "../components/data-status-display";
import { ContactMessage } from "@/types/message";
import MessageCard from "../components/message-card";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/spinner";

export default function ContactMessagePage() {
  const {
    data,
    isPending: isPendingMessage,
    isError,
    error,
    refetch,
  } = useMessagesQuery();
  const { mutateAsync: markAllMessageAsRead, isPending } =
    useMarkAllMessagesAsReadMutation();
  const contactMessage = data?.data || [];

  if (isPendingMessage || isError) {
    return (
      <DataStatusDisplay
        isPending={isPendingMessage}
        hasError={isError}
        errorObject={error}
        refetch={refetch}
      />
    );
  }

  if (contactMessage.length === 0) {
    return <div>Aucun Message pour le moment</div>;
  }

  const isNotReadMessage = contactMessage.filter((mes) => mes.isRead == false);

  const handleMarkAllMessageAsRead = async (isRead: boolean) => {
    const formData = new FormData();
    formData.append("isRead", `${isRead}`);
    try {
      await markAllMessageAsRead(formData);
    } catch (error) {
      console.log("Erreur: ", error);
    }
  };

  return (
    <section className="py-4 px-2 size-full container max-w-[55rem] mx-auto flex flex-col gap-8">
      <div className="px-2 py-8 md:p-8 sm:px-4 mx-auto sm:w-5/6 w-full">
        <div className="flex justify-between">
          <h1 className="font-bold text-xl">Contact Message</h1>
          <div>
            {isNotReadMessage.length > 0 ? (
              <Button onClick={() => handleMarkAllMessageAsRead(true)}>
                Tout marquer comme lu
                {isPending && <Spinner />}
              </Button>
            ) : (
              <Button onClick={() => handleMarkAllMessageAsRead(false)}>
                Tout marquer comme non lu
                {isPending && <Spinner />}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-col py-4 gap-4">
          {contactMessage.map((message: ContactMessage, i: number) => (
            <div key={`${message}-${i}`}>
              <MessageCard message={message} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
