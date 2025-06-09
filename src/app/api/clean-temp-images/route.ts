import { NextResponse } from "next/server";
import { list, del } from "@vercel/blob";

const TEMP_FOLDER_PREFIX = "uploads/temp/";
const TEMP_LIFETIME_HOURS = 12; // Supprimer les images de plus de 12 heures

export async function GET() {
  try {
    const { blobs } = await list({ prefix: TEMP_FOLDER_PREFIX });

    const now = new Date();
    const urlsToDelete: string[] = [];

    for (const blob of blobs) {
      // Vérifier si la blob a une `uploadedAt` valide et est plus ancienne que TEMP_LIFETIME_HOURS
      if (blob.uploadedAt) {
        const uploadTime = new Date(blob.uploadedAt);
        const ageInMs = now.getTime() - uploadTime.getTime();
        const ageInHours = ageInMs / (1000 * 60 * 60);

        if (ageInHours > TEMP_LIFETIME_HOURS) {
          urlsToDelete.push(blob.url);
        }
      }
    }

    if (urlsToDelete.length > 0) {
      await Promise.all(
        urlsToDelete.map((url) =>
          del(url).catch((e) =>
            console.error(`Failed to delete temporary blob ${url}:`, e)
          )
        )
      );
      console.log(`Cleaned up ${urlsToDelete.length} temporary images.`);
    } else {
      console.log("No old temporary images to clean up.");
    }

    return NextResponse.json({
      message: `Cleaned up ${urlsToDelete.length} temporary images.`,
    });
  } catch (error) {
    console.error("Error during temporary image cleanup:", error);
    return NextResponse.json(
      { error: "Failed to clean up temporary images." },
      { status: 500 }
    );
  }
}
