/**
 * Which garment registry types (lib/garment/registry) each base article stands behind, so designs made before the
 * catalogue existed keep working (decision 0066 has the table and the reasons). The first type of an article is the one
 * a new design on that article is made as, and is stored on the article row as `registry_type_id`.
 *
 * A registry type maps to at most one article. A type with no article (socks, caps, leggings, jackets) stays a registry
 * type only, as before; an article with no type (fight shorts) has no design route until the drafter (X3) gives it one.
 */
const ARTICLE_TYPES: Readonly<Record<string, readonly string[]>> = {
  "JSY-SS-01": ["football-shirt", "team-jersey"],
  "SHO-TR-01": ["football-shorts", "shorts"],
  "JSY-LS-01": ["goalkeeper-shirt", "long-sleeve-tee"],
  "CRK-SS-01": ["cricket-shirt"],
  "TEE-TR-01": ["crew-tee", "v-neck-tee", "cricket-training-tee"],
  "HOD-ST-01": ["pullover-hoodie", "zip-hoodie"],
  "CMP-LS-01": ["compression-top"],
  "FSH-MM-01": [],
};

const TYPE_ARTICLE: ReadonlyMap<string, string> = new Map(
  Object.entries(ARTICLE_TYPES).flatMap(([code, types]) => types.map((type) => [type, code] as const)),
);

/** Every article code the map knows, in launch order. */
export const MAPPED_ARTICLE_CODES: readonly string[] = Object.keys(ARTICLE_TYPES);

/** The base article a registry type is made on, or undefined for a type the catalogue does not cover. */
export const baseArticleForType = (typeId: string): string | undefined => TYPE_ARTICLE.get(typeId);

/** The registry types a base article stands behind, the main one first. Empty for an unknown code. */
export const typesForBaseArticle = (code: string): readonly string[] => ARTICLE_TYPES[code] ?? [];

/** The registry type a new design on the article is made as, or null when there is none yet. */
export const registryTypeForBaseArticle = (code: string): string | null => typesForBaseArticle(code)[0] ?? null;
