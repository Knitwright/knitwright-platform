import type { LucideIcon, LucideProps } from "lucide-react";
import { cx } from "./cx";

/**
 * A Lucide icon at one of the sizes of docs/spec/10-design-system.md §6: 14 for the factory lock,
 * 16 inline in text, 20 in buttons and menus, 22 in the left nav and the rail. Stroke 1.75 and
 * `currentColor`, always. Icons are decoration: the control around one carries its name.
 */
export type IconSize = 14 | 16 | 20 | 22;

type IconProps = Readonly<Omit<LucideProps, "size" | "strokeWidth"> & { icon: LucideIcon; size?: IconSize }>;

export function Icon({ icon: Glyph, size = 20, className, ...rest }: IconProps) {
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" className={cx("shrink-0", className)} {...rest} />;
}

/** The loading spinner that takes an icon's place (§8 "loading"). */
export function Spinner({ size = 16, className }: Readonly<{ size?: IconSize; className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      data-spinner=""
      className={cx("shrink-0 motion-safe:spin", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
