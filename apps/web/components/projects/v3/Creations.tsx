import { ImageOff, Lock } from "lucide-react";
import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import type { Shape } from "@/lib/projects-page/creations";
import type { ShownCreation } from "@/lib/projects-page/load";

const SHAPES: Readonly<Record<Shape, string>> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  tall: "aspect-[9/16]",
  wide: "aspect-video",
};

function Picture({ creation }: Readonly<{ creation: ShownCreation }>) {
  if (creation.url === null) {
    return (
      <span className="grid size-full place-items-center text-muted">
        <Icon icon={ImageOff} size={22} />
        <span className="sr-only">This picture could not be loaded.</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- A short-lived storage link, drawn as it is.
    <img src={creation.url} alt={`${creation.label}, made ${creation.createdAt.slice(0, 10)}`} className="size-full object-cover" loading="lazy" />
  );
}

/** AI Creations (d06): a two-column masonry of the brand's AI pictures, each opening where it was made. */
export function CreationsMasonry({ creations }: Readonly<{ creations: readonly ShownCreation[] }>) {
  return (
    <ul aria-label="AI creations" className="columns-1 gap-2.5 sm:columns-2">
      {creations.map((creation) => (
        <li key={creation.id} className="mb-4 break-inside-avoid" data-testid="creation-tile">
          <Link href={creation.href} className={cx("relative block overflow-hidden rounded-xl bg-soft", SHAPES[creation.shape])}>
            <Picture creation={creation} />
            {creation.garmentLocked ? (
              <span className="absolute top-2.5 right-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-bg px-2.5 text-caption font-semibold text-text">
                <Icon icon={Lock} size={14} className="text-gold-3" />
                Garment locked
              </span>
            ) : null}
            <span className="sr-only">Open where it was made</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
