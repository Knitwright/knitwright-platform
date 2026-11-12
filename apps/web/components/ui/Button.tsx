import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { ArrowMark } from "./ArrowMark";
import { cx } from "./cx";
import { Spinner } from "./Icon";
import { Tooltip } from "./Tooltip";

/**
 * Buttons (docs/spec/10-design-system.md §8). One primary per surface; it is navy, or gold
 * (`premium`) only for upgrades and buying credits. Everything else is `secondary`.
 *
 * States: hover one step darker (or `soft`), pressed two steps, focus-visible the global
 * electric ring, disabled 40% with a tooltip saying why (`disabledReason`), loading a spinner
 * in the icon's place with the label kept so the width does not change.
 *
 * `quiet` is the v2.2 text button, kept so its callers still work; new code uses `ghost`.
 */

export type ButtonVariant = "primary" | "secondary" | "premium" | "ghost" | "danger" | "link" | "quiet";
export type ButtonSize = "lg" | "md" | "sm" | "xs";

const BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold select-none transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

const SIZES: Readonly<Record<ButtonSize, string>> = {
  lg: "h-11 px-4.5 rounded-md text-body-lg font-semibold",
  md: "h-10 px-4 rounded-md text-body font-semibold",
  sm: "h-8 px-3 rounded-sm text-small font-semibold",
  xs: "h-7 px-2.5 rounded-btn-xs text-caption font-semibold",
};

const SQUARE: Readonly<Record<ButtonSize, string>> = {
  lg: "w-11 px-0",
  md: "w-10 px-0",
  sm: "w-8 px-0",
  xs: "w-7 px-0",
};

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: "bg-navy text-on-dark live:hover:bg-navy-2 live:active:bg-navy-3",
  secondary: "border border-border bg-bg text-text live:hover:bg-soft live:active:bg-soft-2",
  premium: "bg-gold text-navy live:hover:bg-gold-2 live:active:bg-gold-3",
  ghost: "bg-transparent text-text-2 live:hover:bg-soft live:active:bg-soft-2",
  danger: "border border-border bg-bg text-bad live:hover:bg-bad-soft live:active:border-bad live:active:bg-bad-soft",
  link: "bg-transparent text-link underline-offset-2 live:hover:underline",
  quiet: "bg-transparent text-muted live:hover:text-text",
};

/** The classes of a button. Shared with LinkButton so links and buttons match. */
export const buttonClasses = (
  variant: ButtonVariant,
  arrow = false,
  className = "",
  size: ButtonSize = "md",
  iconOnly = false,
): string => {
  const sized = variant === "link" ? "h-auto p-0 text-body font-semibold" : cx(SIZES[size], iconOnly && SQUARE[size]);
  return cx(BASE, sized, VARIANTS[variant], arrow && variant === "primary" && "pr-2", className);
};

/** What goes inside a button: the icon (or the spinner while loading), the label and the arrow. */
export function ButtonInner({
  variant,
  arrow,
  icon,
  loading = false,
  children,
}: Readonly<{ variant: ButtonVariant; arrow: boolean; icon?: ReactNode; loading?: boolean; children?: ReactNode }>) {
  return (
    <>
      {loading ? <Spinner /> : icon}
      {children}
      {arrow && variant === "primary" ? (
        <span className="grid size-6 place-items-center rounded-full bg-bg text-navy" aria-hidden="true">
          <ArrowMark />
        </span>
      ) : null}
    </>
  );
}

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    ref?: Ref<HTMLButtonElement>;
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows progress and blocks a second press. Same as `loading`. */
    pending?: boolean;
    loading?: boolean;
    /** A trailing arrow disc. Primary buttons only. */
    arrow?: boolean;
    /** An icon before the label, usually `<Icon icon={Plus} />`. */
    icon?: ReactNode;
    /** A square icon button. Give it an `aria-label`. */
    iconOnly?: boolean;
    /**
     * Disables the button and says why in a tooltip (§8). The button keeps its focus, so a
     * keyboard user hears the reason; it is aria-disabled, has no click handler and never submits.
     */
    disabledReason?: string;
    children?: ReactNode;
  }
>;

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  loading = false,
  arrow = false,
  icon,
  iconOnly = false,
  disabledReason,
  disabled,
  type = "button",
  className = "",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const busy = pending || loading;
  const explained = Boolean(disabledReason);
  const button = (
    <button
      {...rest}
      // Disabled with a reason, the button stays focusable but does nothing: no handler, and
      // never a submit button, so neither a click nor Enter can act.
      type={explained ? "button" : type}
      disabled={explained ? undefined : disabled || busy}
      aria-disabled={explained || undefined}
      aria-busy={busy || undefined}
      onClick={explained ? undefined : onClick}
      className={buttonClasses(variant, arrow, className, size, iconOnly)}
    >
      <ButtonInner variant={variant} arrow={arrow} icon={icon} loading={busy}>
        {children}
      </ButtonInner>
    </button>
  );
  return disabledReason ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}
