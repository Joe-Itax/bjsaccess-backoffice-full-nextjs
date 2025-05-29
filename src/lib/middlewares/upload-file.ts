import { put, del } from "@vercel/blob";
import mime from "mime";

type Folder = "avatars" | "featured-images";

export async function handleUpload({
  file,
  folder,
  filenamePrefix,
}: {
  file: Blob;
  folder: Folder;
  filenamePrefix: string;
}): Promise<string> {
  const ext = mime.getExtension(file.type) || "bin";
  const filename = `${filenamePrefix}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.${ext}`;

  const blobPath = `uploads/${folder}/${filename}`;

  const { url } = await put(blobPath, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return url;
}

export async function deleteFileFromVercelBlob(fileUrl: string) {
  await del(fileUrl);
}
