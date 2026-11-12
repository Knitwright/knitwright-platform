import type { Route } from "next";
import { ARTICLE_CODE } from "@/lib/catalogue/vocabulary";

/**
 * The addresses of the Products area (plan v6 P4, decision 0142; `docs/spec/09-screen-map.md` screens 10, 11, 22
 * and 26). `/products/<slug>` serves both a product (`/products/JSY-SS-01`) and a category (`/products/football`),
 * as the screen map gives both that shape: a base article code and a category name can never be mistaken for each
 * other, because every code is three letters, a dash, two letters, a dash and two characters.
 */

export const PRODUCTS_PATH = "/products";
export const MY_PRODUCTS_PATH = "/products/mine";
export const TRENDS_PATH = "/products/trends";
export const FABRICS_PATH = "/products/fabrics";

/** The four tabs under the page title (09 screen 10, v3.5). */
export const PRODUCTS_TABS = [
  { href: PRODUCTS_PATH, label: "Catalogue" },
  { href: MY_PRODUCTS_PATH, label: "My products" },
  { href: TRENDS_PATH, label: "Trending ideas" },
  { href: FABRICS_PATH, label: "Fabrics" },
] as const satisfies readonly Readonly<{ href: Route; label: string }>[];

export type ProductsTab = (typeof PRODUCTS_TABS)[number]["href"];

export const productHref = (code: string): Route => `/products/${code}` as Route;

/** A category page, with the filters of its filter bar kept. */
export const categoryHref = (slug: string, query: Readonly<Record<string, string>> = {}): Route => {
  const search = new URLSearchParams(query).toString();
  return `/products/${slug}${search === "" ? "" : `?${search}`}` as Route;
};

/** The category that holds every base article, so "View all" has somewhere to go. */
export const ALL_CATEGORY = "all";

export type Slug = Readonly<{ kind: "product"; code: string }> | Readonly<{ kind: "category"; slug: string }> | null;

/**
 * What `/products/<slug>` names. A code is matched without regard to case, as the old catalogue address was; a
 * category is a lower-case word with dashes. Anything else is nothing, and the page answers not found.
 */
export function readSlug(raw: string): Slug {
  const decoded = safeDecode(raw);
  if (decoded === null) return null;
  const upper = decoded.toUpperCase();
  if (ARTICLE_CODE.test(upper)) return { kind: "product", code: upper };
  if (/^[a-z][a-z0-9-]{0,39}$/.test(decoded)) return { kind: "category", slug: decoded };
  return null;
}

const safeDecode = (raw: string): string | null => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
};
