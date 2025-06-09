import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { handleUpload } from "@/lib/middlewares/upload-file";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  // const currentUser = session.user;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier uploader" },
        { status: 400 }
      );
    }

    // Convertir le File en Blob, car handleUpload attend un Blob
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    // Vous pouvez définir un préfixe basé sur l'utilisateur, un ID unique, etc.
    // Pour cet exemple, j'utilise un préfixe statique.
    const filenamePrefix = `editor-temp-${uuidv4()}`;
    const folder = "temp";

    const imageUrl = await handleUpload({
      file: fileBlob,
      folder: folder,
      filenamePrefix: filenamePrefix,
    });

    // Retournez l'URL de l'image pour que Tiptap puisse l'insérer
    return NextResponse.json({ url: imageUrl }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
