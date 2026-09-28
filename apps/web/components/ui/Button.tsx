import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "quiet";

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    /** Shows progress and blocks a second press. */
    pending?: boolean;
    children: ReactNode;
  }
>;

const BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Readonly<Record<Variant, string>> = {
  primary: "bg-cobalt text-white hover:bg-[#2238c8]",
  secondary: "border border-hairline bg-surface text-ink hover:bg-shell",
  quiet: "text-muted hover:text-ink",
};

export function Button({
  variant = "primary",
  pending = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
