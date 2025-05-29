"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useCategoriesQuery,
  usePostByIdQuery,
  useUpdatePostMutation,
} from "@/hooks/use-posts";
import { Category } from "@/types/posts";
import Spinner from "@/components/spinner";
import { useParams, useRouter } from "next/navigation";
import { MoveLeftIcon } from "lucide-react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

type PostFormData = {
  title: string;
  content: string;
  featuredImage?: File | null;
  categoryId: string;
};

export default function UpdatePostPage() {
  const { postSlug } = useParams();
  const router = useRouter();

  const { data: categories, isPending: catIsPending } = useCategoriesQuery();
  const { data, isPending: postIsPending } = usePostByIdQuery(
    postSlug as string
  );
  const post = data?.post;
  const { mutateAsync: updatePostMutation, isPending } =
    useUpdatePostMutation();

  const [formData, setFormData] = useState<PostFormData>({
    title: "",
    content: "",
    featuredImage: null,
    categoryId: "",
  });

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        featuredImage: null,
        categoryId: post.category.id,
      });
    }
  }, [post]);

  const [errors, setErrors] = useState<
    Partial<Record<keyof PostFormData, string>>
  >({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PostFormData, string>> = {};

    if (!formData.title.trim()) newErrors.title = "Le titre est requis";
    if (!formData.content.trim() || formData.content === "<p></p>")
      newErrors.content = "Le contenu est requis";
    if (!formData.categoryId) newErrors.categoryId = "La catégorie est requise";
    if (
      formData.featuredImage &&
      formData.featuredImage.size > 1024 * 1024 // 1Mo
    ) {
      newErrors.featuredImage = "L'image ne doit pas dépasser 1 Mo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const form = new FormData();
    form.append("title", formData.title);
    form.append("content", formData.content);
    form.append("categoryId", formData.categoryId);
    if (formData.featuredImage instanceof File) {
      form.append("featuredImage", formData.featuredImage);
    }

    try {
      await updatePostMutation({
        slug: post!.slug,
        form,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleEditorChange = (htmlContent: string) => {
    setFormData((prev) => ({ ...prev, content: htmlContent }));
    if (errors.content) {
      setErrors((prev) => ({ ...prev, content: undefined }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({
      ...prev,
      featuredImage: file,
    }));
  };

  if (catIsPending || postIsPending || !post) {
    return (
      <div className="w-full py-64 flex justify-center items-center">
        <div className="flex gap-4 items-center">
          Chargement... <Spinner />
        </div>
      </div>
    );
  }

  return (
    <section className="container size-full mx-auto flex justify-center">
      <div className="px-4 md:p-8 sm:px-4 size-full">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/posts/${post.slug}`)}
        >
          <MoveLeftIcon />
        </Button>
        <h1 className="ml-0 mb-4 text-2xl font-bold">
          Modifier l&apos;article
        </h1>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                errors.title ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.title && (
              <p className="text-red-500 text-sm">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu *</Label>
            <div className="w-full">
              <SimpleEditor
                initialContent={formData.content}
                onContentChange={handleEditorChange}
              />
            </div>
            {errors.content && (
              <p className="text-red-500 text-sm">{errors.content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="featuredImage">Image mise en avant</Label>
            <input
              id="featuredImage"
              name="featuredImage"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full p-2 border border-gray-300 rounded cursor-pointer"
            />
            {errors.featuredImage && (
              <p className="text-red-500 text-sm">{errors.featuredImage}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Catégorie *</Label>
            <select
              id="categoryId"
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                errors.categoryId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="" disabled>
                Sélectionnez une catégorie
              </option>
              {categories.map((category: Category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-red-500 text-sm">{errors.categoryId}</p>
            )}
          </div>
        </div>
        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Enregistrement..." : "Enregistrer"}
            {isPending && <Spinner />}
          </Button>
        </div>
      </div>
    </section>
  );
}
