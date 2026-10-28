import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowMark } from "./ArrowMark";

export type Variant = "primary" | "secondary" | "quiet";

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    /** Shows progress and blocks a second press. */
    pending?: boolean;
    /** Adds the turning arrow disc of the homepage call to action. Primary buttons only. */
    arrow?: boolean;
    children: ReactNode;
  }
>;

const BASE =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium disabled:cursor-not-allowed disabled:opacity-55";

/** The classes of each kind of button. Shared with LinkButton so links and buttons match. */
const BUTTON_VARIANTS: Readonly<Record<Variant, string>> = {
  primary: "chip-cta thread-ring bg-white/5 text-white",
  secondary: "chip-btn border border-white/20 bg-white/[0.04] text-ink backdrop-blur-md",
  quiet: "soft-link text-muted transition-colors hover:text-ink",
};

export const buttonClasses = (variant: Variant, arrow: boolean, className = ""): string =>
  `${BASE} ${BUTTON_VARIANTS[variant]} ${variant === "primary" && arrow ? "pr-1.5" : ""} ${className}`;

/** What goes inside a button: the fill that grows on hover, the label and the arrow disc. */
export function ButtonInner({ variant, arrow, children }: Readonly<{ variant: Variant; arrow: boolean; children: ReactNode }>) {
  if (variant !== "primary") return <>{children}</>;
  return (
    <>
      <span className="chip-fill" aria-hidden="true" />
      <span className="chip-label inline-flex items-center gap-2">{children}</span>
      {arrow ? (
        <span className="chip-disc size-8" aria-hidden="true">
          <ArrowMark />
        </span>
      ) : null}
    </>
  );
}

export function Button({
  variant = "primary",
  pending = false,
  arrow = false,
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
      className={buttonClasses(variant, arrow, className)}
    >
      <ButtonInner variant={variant} arrow={arrow}>
        {children}
      </ButtonInner>
    </button>
  );
}
