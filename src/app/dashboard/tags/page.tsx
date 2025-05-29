"use client";

import { useTagsQuery } from "@/hooks/use-posts";
import { Tag } from "@/types/posts";
import AddTag from "./add-tag";
import DeleteTag from "./delete-tag";
import DataStatusDisplay from "../components/data-status-display";
export default function TagsPage() {
  const {
    data: tags = [],
    isPending,
    isError,
    error,
    refetch,
  } = useTagsQuery();

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
    <section className="container max-w-[55rem] size-full mx-auto">
      <div className="w-full p-4 flex flex-col gap-6">
        <div className="flex gap-4">
          <h2 className="text-xl font-medium">#Tags Disponible</h2>

          <AddTag />
        </div>
        <ol className="w-full flex flex-wrap justify-center items-center gap-3">
          {tags?.map((tag: Tag, i: number) => (
            <div key={tag.id}>
              <li className="flex gap-2 items-center bg-white shadow-xl border rounded-4xl py-2 px-4">
                <span>
                  {" "}
                  {i + 1}. <span>#{tag.name}</span>
                </span>

                <DeleteTag tag={tag} />
              </li>
            </div>
          ))}
        </ol>
      </div>
    </section>
  );
}
