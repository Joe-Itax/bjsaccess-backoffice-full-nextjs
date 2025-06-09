import { JSDOM } from "jsdom";
import { moveFileInVercelBlob } from "@/lib/middlewares/upload-file";

/**
 * Extrait toutes les URLs des balises <img> d'un contenu HTML.
 * @param htmlContent Le contenu HTML à analyser.
 * @returns Un tableau de strings contenant les URLs des images.
 */
export function extractImageUrls(
  htmlContent: string | null | undefined
): string[] {
  if (!htmlContent) {
    return [];
  }
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  const imgElements = document.querySelectorAll("img");
  const urls: string[] = [];
  imgElements.forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      urls.push(src);
    }
  });
  return urls;
}

/**
 * Traite les images dans le contenu HTML:
 * - Déplace les images temporaires vers un emplacement permanent.
 * - Met à jour les URLs dans le HTML.
 * - Identifie les images à supprimer (celles qui étaient présentes mais ne le sont plus).
 * @param htmlContent Le contenu HTML de l'article (potentiellement avec des URLs temporaires).
 * @param postSlug Le slug de l'article pour structurer les dossiers permanents.
 * @param currentDbContentUrls Les URLs d'images de l'ancien contenu (récupérées de la DB avant la MAJ, pour un PUT).
 * @returns Un objet contenant le contenu HTML mis à jour, une liste d'URLs à supprimer,
 * et une liste d'URLs d'images qui ont été nouvellement traitées/déplacées.
 */
export async function processContentImages(
  htmlContent: string | null | undefined,
  postSlug: string,
  currentDbContentUrls: string[] = [] // Les URLs d'images de l'article tel qu'il est actuellement en DB
): Promise<{
  updatedHtml: string;
  imageUrlsToDelete: string[];
  newlyProcessedImageUrls: string[];
}> {
  if (!htmlContent) {
    // Si pas de contenu, on ne supprime que les anciennes images
    return {
      updatedHtml: "",
      imageUrlsToDelete: currentDbContentUrls,
      newlyProcessedImageUrls: [],
    };
  }

  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  const imgElements = document.querySelectorAll("img");

  const newContentImageUrls: string[] = []; // URLs qui seront dans le nouveau contenu après traitement
  const newlyProcessedImageUrls: string[] = []; // URLs des images qui ont été déplacées/traitées dans cette requête

  const imagesToProcess: {
    oldUrl: string;
    newPath: string;
    originalImgElement: HTMLImageElement;
  }[] = [];

  for (const img of Array.from(imgElements)) {
    const src = img.getAttribute("src");
    if (src && src.includes("/uploads/temp/")) {
      // Cible spécifiquement les images dans le dossier 'temp'
      const filename = src.substring(src.lastIndexOf("/") + 1);

      const newPath = `uploads/editor-images/${postSlug}/${filename}`;
      imagesToProcess.push({ oldUrl: src, newPath, originalImgElement: img });
    } else if (src) {
      // Si l'image n'est pas temporaire, elle fait déjà partie du contenu (nouvel ou ancien)
      newContentImageUrls.push(src);
    }
  }

  // Effectuer les opérations de déplacement et mettre à jour le DOM in-memory
  for (const { oldUrl, newPath, originalImgElement } of imagesToProcess) {
    try {
      // moveFileInVercelBlob gère le déplacement du fichier et retourne la nouvelle URL.
      const finalUrl = await moveFileInVercelBlob(oldUrl, newPath);
      originalImgElement.setAttribute("src", finalUrl);
      newContentImageUrls.push(finalUrl); // Ajouter la nouvelle URL permanente à la liste des URLs du nouveau contenu
      newlyProcessedImageUrls.push(finalUrl); // Ajouter à la liste des images *nouvellement traitées*
    } catch (error) {
      console.error(`Failed to process image ${oldUrl}:`, error);
      // En cas d'échec, nous conservons l'ancienne URL pour ne pas perdre l'image dans l'éditeur.
      // Cela signifie qu'elle restera dans `temp` et devra être nettoyée par le job cron.
      if (originalImgElement) {
        originalImgElement.setAttribute("src", oldUrl);
        newContentImageUrls.push(oldUrl); // On garde l'URL temporaire si le déplacement échoue
      }
    }
  }

  // Identifier les images à supprimer (celles qui étaient en DB mais ne sont plus dans le nouveau contenu)
  const imageUrlsToDelete: string[] = currentDbContentUrls.filter((dbUrl) => {
    // Ne supprimer que les images qui sont gérées par notre système (pas des URLs externes)
    // et qui ne sont plus présentes dans le nouveau contenu après traitement.
    return (
      dbUrl.includes(`/uploads/editor-images/${postSlug}/`) && // S'assurer que c'est une image du post actuel
      !newContentImageUrls.includes(dbUrl)
    );
  });

  return {
    updatedHtml: document.body.innerHTML,
    imageUrlsToDelete,
    newlyProcessedImageUrls, // Retourne les URLs des images qui ont été déplacées/traitées
  };
}
