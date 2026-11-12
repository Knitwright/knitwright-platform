"use client";

import { Shirt as ShirtIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/PageStates";
import { Skeleton } from "@/components/ui/Skeleton";
import type { VariantTile } from "@/lib/variants/tiles";

/**
 * The variants a remix or a recolour made, as flats drawn by the editor's own renderer (decision
 * 0141). Each is a set of design changes that already passed validation; "Use this design" saves it
 * as a new version and opens the editor. Nothing here is a generated picture.
 */

type Props = Readonly<{
  tiles: readonly VariantTile[] | null;
  pending: boolean;
  /** The tile being saved, so its button shows progress. */
  saving: string | null;
  onUse: (variantId: string) => void;
}>;

export function VariantResults({ tiles, pending, saving, onUse }: Props) {
  if (pending) {
    return (
      <section aria-label="Making your variants" aria-busy="true" className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((one) => (
          <Skeleton key={one} className="aspect-square rounded-lg" />
        ))}
      </section>
    );
  }
  if (tiles === null) return null;
  if (tiles.length === 0) {
    return (
      <EmptyState icon={<Icon icon={ShirtIcon} size={22} />} title="No variant passed the checks">
        Every candidate for this design broke a factory rule or repeated another, so none is shown. Try another era, pattern or colour.
      </EmptyState>
    );
  }
  return (
    <section aria-labelledby="variants-heading" className="flex flex-col gap-4" data-testid="ai-studio-variants">
      <h2 id="variants-heading" className="text-h3 text-text">
        Just now · {tiles.length} {tiles.length === 1 ? "variant" : "variants"}
      </h2>
      <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.id} className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4">
            <div className="grid aspect-square place-items-center rounded-lg bg-soft p-3">
              {/* A flat the platform's own renderer drew, as an SVG data address: nothing in it can run. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {tile.src ? <img src={tile.src} alt={tile.alt} className="size-full object-contain" /> : <p className="text-small text-muted">{tile.alt}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-title text-text">{tile.label}</h3>
              <p className="text-small text-muted">{tile.summary}</p>
              {tile.warnings.map((warning) => (
                <p key={`${warning.code}-${warning.panel ?? ""}`} className="text-caption text-warn">
                  {warning.message}
                </p>
              ))}
            </div>
            <Button variant="secondary" size="sm" pending={saving === tile.id} disabled={saving !== null} onClick={() => onUse(tile.id)}>
              Use this design
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
