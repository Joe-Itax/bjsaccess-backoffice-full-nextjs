import mime from "mime";
import path from "path";
import { stat, mkdir, writeFile, unlink, readdir } from "fs/promises";

type Folder = "avatars" | "featured-image";

// Fonction principale appelée dans les routes API
export async function handleUpload({
  file,
  folder,
  filenamePrefix,
}: {
  file: Blob;
  folder: Folder;
  filenamePrefix: string;
}): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = mime.getExtension(file.type) || "bin";

  const filename = `${filenamePrefix}.${ext}`;
  const relativePath = `/uploads/${folder}`;
  const uploadDir = path.join(process.cwd(), "public", relativePath);
  const filePath = path.join(uploadDir, filename);

  try {
    await stat(uploadDir);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "ENOENT") {
      await mkdir(uploadDir, { recursive: true });
    } else {
      console.error("Error creating upload directory", e);
      throw new Error("Upload directory creation failed");
    }
  }

  const userId = filenamePrefix.split("-")[1]; // Extrait l’id à partir de "avatar-123..."
  await removeOldFiles({
    folder,
    userId,
    currentFilename: filename,
  });

  await writeFile(filePath, buffer);

  return `${relativePath}/${filename}`;
}

export function slugify(str: string): string {
  return str
    .normalize("NFD") // décomposer les caractères accentués
    .replace(/[\u0300-\u036f]/g, "") // supprimer les diacritiques (accents)
    .toLowerCase()
    .replace(/\s+/g, "-") // espaces → tirets
    .replace(/[^a-z0-9\-]/g, "") // supprimer tout le reste sauf lettres, chiffres, tirets
    .replace(/-+/g, "-") // évite les tirets multiples
    .replace(/^-+|-+$/g, ""); // supprime les tirets en début/fin
}

export async function removeOldFiles({
  folder,
  userId,
  currentFilename,
}: {
  folder: Folder;
  userId: string;
  currentFilename: string;
}) {
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  const files = await readdir(uploadDir);

  const matchingFiles = files.filter(
    (file) => file.includes(userId) && file !== currentFilename // évite de supprimer l'actuel
  );

  await Promise.all(
    matchingFiles.map((file) =>
      unlink(path.join(uploadDir, file)).catch((e) =>
        console.warn(`Erreur suppression ${file}:`, e)
      )
    )
  );
}
