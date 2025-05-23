import { prisma, Prisma } from "@/lib/prisma";

export function slugify(text: string): string {
  if (!text) return "";

  return text
    .toString() // Ensure it's a string
    .normalize("NFD") // Normalize characters for consistent accent removal
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics (accents)
    .toLowerCase() // Convert to lowercase
    .trim() // Trim whitespace from both ends
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * Génère un slug unique pour une entité donnée en vérifiant sa non-existence dans la base de données.
 *
 * @param {string} name Le nom de base à partir duquel générer le slug.
 * @param {'category' | 'post' | 'tag'} modelType Le type de modèle Prisma à interroger.
 * @returns {Promise<string>} Le slug unique généré.
 */
export async function generateUniqueSlug(
  name: string,
  modelType: "category" | "post" | "tag"
): Promise<string> {
  const baseSlug = slugify(name);
  let uniqueSlug = baseSlug;
  let counter = 0;

  // Définissons un type union pour les délégués Prisma que nous allons utiliser.
  // Ce type inclut les méthodes findUnique qui acceptent les arguments spécifiques à chaque modèle
  // et retournent le type de payload correspondant.
  type Delegate =
    | Prisma.CategoryDelegate
    | Prisma.PostDelegate
    | Prisma.TagDelegate;

  let model: Delegate;

  // Récupère le délégué Prisma correct basé sur `modelType`
  switch (modelType) {
    case "category":
      model = prisma.category;
      break;
    case "post":
      model = prisma.post;
      break;
    case "tag":
      model = prisma.tag;
      break;
    default:
      // TypeScript devrait déjà prévenir ceci, mais c'est une sécurité runtime.
      throw new Error(`Unsupported modelType: ${modelType}`);
  }

  while (true) {
    // TypeScript voit que `model` est un type union. Pour accéder à `findUnique` avec `where` et `select`,
    // nous devons faire une assertion de type plus spécifique ou raffiner le type.
    // La méthode la plus directe ici est de typer la clause `where` et `select` en fonction du type
    // du délégué. Puisque nous savons que tous ces délégués ont un champ 'slug' unique,
    // nous pouvons les traiter de manière unifiée pour cette requête.

    // Utilisons un typecast sur l'appel `findUnique` lui-même pour informer TypeScript des arguments attendus.
    // C'est une assertion que la méthode `findUnique` sur ce `model` accepte bien un objet
    // avec `where` et `select` comme spécifié pour un modèle avec un slug.
    const existingEntry = await (
      model as unknown as {
        findUnique: (args: {
          where: { slug: string };
          select: { id: boolean };
        }) => Promise<{ id: string } | null>;
      }
    ).findUnique({
      where: {
        slug: uniqueSlug,
      },
      select: {
        id: true,
      },
    });

    if (!existingEntry) {
      break;
    }

    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return uniqueSlug;
}
