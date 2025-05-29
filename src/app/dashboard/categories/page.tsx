"use client";

import { useCategoriesQuery } from "@/hooks/use-posts";
import AddCategory from "./add-category";
import DeleteCategory from "./delete-category";
import { Category } from "@/types/posts";
import DataStatusDisplay from "../components/data-status-display";
export default function CategoriesPage() {
  const {
    data: categories = [],
    isPending,
    isError,
    error,
    refetch,
  } = useCategoriesQuery();

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
          <h2 className="text-xl font-medium">Categories Disponible</h2>

          <AddCategory />
        </div>
        <ol className="w-full flex flex-wrap justify-center items-center gap-3">
          {categories?.map((category: Category, i: number) => (
            <div key={category.id}>
              <li className="flex flex-col gap-2 items-center bg-white shadow-xl border rounded-4xl py-2 px-4">
                <div className="flex items-center">
                  <span>
                    {" "}
                    {i + 1}. <span>{category.name}</span>
                  </span>
                  <DeleteCategory category={category} />
                </div>
                {category.description && (
                  <div>
                    <span className="text-gray-500 text-sm">
                      Description: {category.description}
                    </span>
                  </div>
                )}
              </li>
            </div>
          ))}

          {categories?.length === 0 && (
            <div className="w-full flex justify-center items-center">
              <p className="text-gray-500 text-sm">
                Aucune catégorie disponible pour le moment
              </p>
            </div>
          )}
        </ol>
      </div>
    </section>
  );
}
