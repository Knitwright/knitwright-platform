import { cx } from "@/components/ui/cx";
import { renderOf } from "@/lib/products/render";

/**
 * The picture of a base: the editor's own flat of its garment type, or a plain outline where the base has no type
 * yet. It is decorative on a card (the name is beside it) and described in the gallery.
 */
export function ProductRender({ typeId, className, describe = false }: Readonly<{ typeId: string | null; className?: string; describe?: boolean }>) {
  const render = renderOf(typeId);
  if (render === null) return <Outline className={className} />;
  return (
    // A data address drawn on the server: the image optimiser has nothing to fetch.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={render.src} alt={describe ? render.alt : ""} className={cx("h-auto max-h-full w-3/4 object-contain", className)} />
  );
}

function Outline({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 96 104" aria-hidden="true" focusable="false" className={cx("h-auto w-1/2 text-border-strong", className)}>
      <path d="M30 4 L18 8 L2 30 L16 40 L22 32 L22 100 L74 100 L74 32 L80 40 L94 30 L78 8 L66 4 Q48 18 30 4 Z" className="fill-bg" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
