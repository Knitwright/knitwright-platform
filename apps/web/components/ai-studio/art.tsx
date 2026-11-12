import type { Tone } from "@/lib/ai-studio/catalogue";
import { cx } from "@/components/ui/cx";

/**
 * The output pictures of AI Studio's cards and examples (decision 0141): a gradient of token colours
 * with a plain tee on it. Our own drawing -- no Kittl artwork (decision 0131, rule 4) -- and never a
 * picture that claims to be a real output.
 */

export const TONE_CLASSES: Readonly<Record<Tone, Readonly<{ ground: string; shirt: string }>>> = {
  navy: { ground: "bg-linear-to-br from-navy to-electric", shirt: "text-navy-3" },
  gold: { ground: "bg-linear-to-br from-gold to-warn", shirt: "text-ok" },
  pitch: { ground: "bg-linear-to-br from-navy-3 to-ok", shirt: "text-bad" },
  light: { ground: "bg-linear-to-br from-soft to-border-strong", shirt: "text-bad" },
  violet: { ground: "bg-linear-to-br from-navy-2 to-navy-3", shirt: "text-gold" },
  sunset: { ground: "bg-linear-to-br from-bad to-gold", shirt: "text-navy" },
  dark: { ground: "bg-linear-to-br from-text to-text-2", shirt: "text-gold" },
  sky: { ground: "bg-linear-to-br from-electric to-electric-soft", shirt: "text-text" },
};

/** A plain tee with a crest square, filled with the current colour. */
export function Shirt({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className={className}>
      <path d="M42 14 L24 22 L8 42 L22 54 L32 46 L32 112 L88 112 L88 46 L98 54 L112 42 L96 22 L78 14 Q60 26 42 14 Z" fill="currentColor" />
      <rect x="66" y="36" width="10" height="10" rx="1.5" className="fill-gold" />
    </svg>
  );
}

/** A card's picture: the tone's gradient and one shirt, square. */
export function ToneArt({ tone, className, children }: Readonly<{ tone: Tone; className?: string; children?: React.ReactNode }>) {
  const look = TONE_CLASSES[tone];
  return (
    <div className={cx("relative grid aspect-square place-items-center overflow-hidden rounded-lg", look.ground, className)}>
      <Shirt className={cx("w-1/2", look.shirt)} />
      {children}
    </div>
  );
}

/** The Output example of a workflow page (screen 4): a grid of shirts in the tone. */
export function OutputExample({ tone, count = 6 }: Readonly<{ tone: Tone; count?: number }>) {
  const look = TONE_CLASSES[tone];
  const shirts = ["text-navy", "text-on-dark", "text-bad", "text-ok", "text-text", "text-gold"].slice(0, Math.max(1, Math.min(6, count)));
  return (
    <div className={cx("relative grid aspect-5/4 w-full place-items-center overflow-hidden rounded-3xl p-10", look.ground)}>
      <span className="absolute top-4 right-4 rounded-full bg-text px-3 py-1.5 text-small font-semibold text-on-dark">Output example</span>
      <div className={cx("grid w-full max-w-90 gap-6", shirts.length > 1 ? "grid-cols-3" : "grid-cols-1 max-w-40")}>
        {shirts.map((colour, index) => (
          <Shirt key={index} className={colour} />
        ))}
      </div>
    </div>
  );
}
