"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCheckIcon, CheckIcon } from "lucide-react";
import { ContactMessage } from "@/types/message";
import { formatDate } from "@/utils/format-date";
import Image from "next/image";

interface messageCardProps {
  message: ContactMessage;
}

export default function MessageCard({ message }: messageCardProps) {
  const [hoverBox, setHoverBox] = useState(false);

  const handleHover = () => {
    setHoverBox(!hoverBox);
  };

  return (
    <Link href={`/dashboard/message/${message.id}`} className="block w-full">
      <div
        className="size-full rounded shadow-lg bg-white hover:shadow-xl transition-shadow duration-300 relative p-4 flex gap-2 justify-between items-center"
        onMouseEnter={handleHover}
        onMouseLeave={handleHover}
      >
        <div className=" w-[10%]">
          <Image
            src={`/user.png`}
            alt={`image-${message.name}`}
            width={50}
            height={50}
            className="size-10"
          />
        </div>
        <div className="flex flex-col gap-1 w-[90%]">
          <div className="flex justify-between">
            <div>
              <p className="font-bold text-gray-800 text-[18px] line-clamp-1">
                {message.name}
              </p>
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
                <p className="line-clamp-1 font-semibold">{message.subject}</p>
              </div>
              <div>
                {" "}
                <p className="line-clamp-1">{message.message}</p>
              </div>
            </div>
            <div className="w-16 flex justify-end items-end">
              {message.isRead ? (
                <CheckCheckIcon className="text-blue-600" />
              ) : (
                <CheckIcon />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
