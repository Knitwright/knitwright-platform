import type { Route } from "next";
import Link from "next/link";
import { galleryAddress, type GalleryFrom } from "@/lib/kit-styles/address";
import { kitStylesFor } from "@/lib/kit-styles/presets";

type LinkProps = Readonly<{ projectId: string; typeId: string; from: GalleryFrom }>;

/**
 * The one way into the kit style gallery, for the guide's Start step and the editor. Nothing is
 * shown for a garment with no kit styles.
 */
export function KitStylesLink({ projectId, typeId, from }: LinkProps) {
  if (kitStylesFor(typeId).length === 0) return null;
  return (
    <p className="text-[15px] leading-relaxed text-muted" data-testid="kit-styles-link">
      Making club kit?{" "}
      <Link href={galleryAddress(projectId, from) as Route} className="font-medium text-cobalt underline-offset-4 hover:underline">
        Choose a kit style
      </Link>{" "}
      such as hoops, stripes or a sash, in your club&apos;s colours.
    </p>
  );
}
