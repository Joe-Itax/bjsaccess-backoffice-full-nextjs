"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MoveLeftIcon } from "lucide-react";
import {
  useCategoriesQuery,
  useCreatePostMutation,
  useTagsQuery,
} from "@/hooks/use-posts";
import { Category, Tag } from "@/types/posts";
import Spinner from "@/components/spinner";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useRouter } from "next/navigation";

type PostFormData = {
  title: string;
  content: string;
  categoryId: string;
  tags: string[];
  featuredImage: File | null;
};
type PostFormErrors = {
  [K in keyof PostFormData]?: string;
};

export default function CreatePost() {
  const { data: categories = [], isPending: catIsPending } =
    useCategoriesQuery();
  const { data: tags = [], isPending: tagIsPending } = useTagsQuery();
  const router = useRouter();
  const [formData, setFormData] = useState<PostFormData>({
    title: "",
    content: "",
    categoryId: "",
    tags: [],
    featuredImage: null,
  });
  const [errors, setErrors] = useState<PostFormErrors>({});
  const { mutateAsync: createPost, isPending } = useCreatePostMutation();

  const validateForm = (): boolean => {
    // const newErrors: Partial<PostFormData> = {};
    const newErrors: PostFormErrors = {};
    if (!formData.title.trim()) newErrors.title = "Le titre est requis";
    if (!formData.content.trim() || formData.content === "<p></p>")
      newErrors.content = "Le contenu est requis";
    if (!formData.categoryId) newErrors.categoryId = "Catégorie requise";
    if (!formData.featuredImage) {
      newErrors.featuredImage = "L'image à la une est requise";
    }
    if (
      formData.featuredImage &&
      formData.featuredImage.size > 5 * 1024 * 1024
    ) {
      newErrors.featuredImage = "L'image ne doit pas dépasser 5 Mo";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const form = new FormData();
    form.append("title", formData.title);
    form.append("content", formData.content); // Append content from Tiptap
    form.append("categoryId", formData.categoryId);
    formData.tags.forEach((tagId) => form.append("tags", tagId));
    if (formData.featuredImage) {
      form.append("featuredImage", formData.featuredImage);
    }

    try {
      // return console.log("form to send: ", form);
      await createPost(form);
      setFormData({
        title: "",
        content: "",
        categoryId: "",
        tags: [],
        featuredImage: null,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (name === "tags") {
      const selectedOptions = Array.from(
        (e.target as HTMLSelectElement).selectedOptions
      ).map((option) => option.value);
      setFormData((prev) => ({ ...prev, tags: selectedOptions }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name as keyof PostFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // New handler for Tiptap content changes
  const handleEditorChange = (htmlContent: string) => {
    setFormData((prev) => ({ ...prev, content: htmlContent }));
    if (errors.content) {
      setErrors((prev) => ({ ...prev, content: undefined }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData((prev) => ({ ...prev, featuredImage: file }));
    setErrors((prev) => ({ ...prev, featuredImage: undefined }));
  };

  if (catIsPending || tagIsPending) {
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
        <Button variant="ghost" onClick={() => router.back()}>
          <MoveLeftIcon />
        </Button>
        <h1 className="ml-0 mb-4 text-2xl font-bold">Créer un nouveau post</h1>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                errors.title ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenu *</Label>
            {/* REMOVED: <textarea ... /> */}
            <div className="w-full">
              <SimpleEditor
                initialContent={formData.content} // Pass current formData.content as initial content
                onContentChange={handleEditorChange} // Capture changes from the editor
              />
            </div>
            {errors.content && (
              <p className="text-sm text-red-500">{errors.content}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Catégorie *</Label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className={`w-full p-2 border rounded ${
                errors.categoryId ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="" disabled>
                -- Sélectionner --
              </option>
              {categories.map((cat: Category) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="text-sm text-red-500">{errors.categoryId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-3">
              {tags.map((tag: Tag) => (
                <label key={tag.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={tag.id}
                    checked={formData.tags.includes(tag.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const tagId = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        tags: checked
                          ? [...prev.tags, tagId]
                          : prev.tags.filter((id) => id !== tagId),
                      }));
                    }}
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="featuredImage">Image à la une</Label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={handleFileChange}
              className={`w-full border p-2 rounded cursor-pointer ${
                errors.featuredImage ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.featuredImage && (
              <p className="text-sm text-red-500">
                {errors.featuredImage?.toString()}
              </p>
            )}
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Création..." : "Créer le post"}
            {isPending && <Spinner />}
          </Button>
        </div>
      </div>
    </section>
  );
}
