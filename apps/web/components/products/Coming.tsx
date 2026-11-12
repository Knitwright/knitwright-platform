import { BookOpen } from "lucide-react";
import { LockedButton } from "./LockedButton";
import { Icon } from "@/components/ui/Icon";
import { SearchInput } from "@/components/ui/Inputs";
import { ALL_CATEGORY } from "@/lib/products/routes";

/**
 * Order swatch book (09 screen 11): a swatch order is a paid order, and orders are paid through checkout, which
 * arrives with workstream C1. Until then the button stays visible and disabled, and its tooltip says why (10 §8
 * "disabled"); there is no form behind it to pretend with.
 */
export const SWATCH_BOOK_COMING = "Swatch books can be ordered once checkout arrives.";

export function SwatchBookButton({ size = "md" }: Readonly<{ size?: "md" | "lg" }>) {
  return (
    <LockedButton size={size} icon={<Icon icon={BookOpen} size={20} />} reason={SWATCH_BOOK_COMING}>
      Order swatch book
    </LockedButton>
  );
}

/** The catalogue's search: it opens every product filtered to the words. */
export function CatalogueSearch() {
  return (
    <form method="get" action={`/products/${ALL_CATEGORY}`} role="search" aria-label="Search the catalogue" className="w-full sm:w-80">
      <label htmlFor="catalogue-search" className="sr-only">
        Search kits, shorts and fabrics
      </label>
      <SearchInput id="catalogue-search" name="q" maxLength={80} placeholder="Search kits, shorts, fabrics…" />
    </form>
  );
}
