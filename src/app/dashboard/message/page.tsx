"use client";
import { useMessagesQuery } from "@/hooks/use-message";
import DataStatusDisplay from "../components/data-status-display";
import { ContactMessage } from "@/types/message";
import MessageCard from "../components/message-card";
import { Button } from "@/components/ui/button";

export default function ContactMessagePage() {
  const { data, isPending, isError, error, refetch } = useMessagesQuery();
  const contactMessage = data?.data || [];

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

  if (contactMessage.length === 0) {
    return <div>Aucun Message pour le moment</div>;
  }

  const isNotReadMessage = contactMessage.filter((mes) => mes.isRead == false);

  return (
    <section className="container size-full mx-auto flex justify-center">
      <div className="px-2 py-8 md:p-8 sm:px-4">
        <div className="flex justify-between">
          <h1 className="font-bold text-xl">Contact Message</h1>
          <div>
            {isNotReadMessage.length > 0 && (
              <Button>Tout marquer comme lu</Button>
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
