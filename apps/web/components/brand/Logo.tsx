import { PRODUCT } from "@/lib/config/product";

type LogoProps = Readonly<{
  size?: number;
  withName?: boolean;
}>;

export function LogoMark({ size = 28 }: Readonly<{ size?: number }>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 280"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="140" cy="140" r="140" style={{ fill: "var(--ink)" }} />
      <path
        transform="translate(48.5 58.5)"
        d="M0 0H183L155 37ZM106 46H147L57 163Z"
        style={{ fill: "var(--canvas)" }}
      />
    </svg>
  );
}

/** The bare mark without its circle, in the current text colour. Used on the dark glass header. */
export function BrandMark({ size = 24 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={(size * 163) / 183} viewBox="0 0 183 163" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M0 0H183L155 37ZM106 46H147L57 163Z" />
    </svg>
  );
}

export function Logo({ size = 28, withName = true }: LogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      {withName ? (
        <span className="text-[17px] font-medium tracking-[-0.02em] text-ink">{PRODUCT.name}</span>
      ) : (
        <span className="sr-only">{PRODUCT.name}</span>
      )}
    </span>
  );
}
