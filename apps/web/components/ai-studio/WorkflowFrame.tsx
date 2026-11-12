"use client";

import { ArrowLeft, Images, Link2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { KwCoin } from "@/components/ui/Marks";
import { NumberInput } from "@/components/ui/NumberInput";
import type { Tone } from "@/lib/ai-studio/catalogue";
import { OutputExample } from "./art";

/**
 * THE WORKFLOW PAGE FORMAT (`09` screen 4, prototype d10; decision 0141): "← AI Studio", then a
 * white card with the form on the left and the Output example on the right with its "Powered by"
 * line. The form's footer holds the image count and Generate, which stays disabled -- with the reason
 * in its tooltip (10 §8) -- until the form is valid. Every workflow, the Image and the Video
 * generator are drawn in this frame.
 */

type FrameProps = Readonly<{
  title: string;
  lead: string;
  tone: Tone;
  poweredBy: string;
  /** How many shirts the example shows. */
  example?: number;
  /** The back link. Absent on the generator tabs, which are reached from the top bar. */
  back?: boolean;
  footer?: ReactNode;
  /** Under the card, full width: the results. */
  after?: ReactNode;
  /**
   * One column with no Output example: for a moved v2.2 screen (crest to kit, benchmarks) that
   * draws its own answer beside its form, kept whole so its behaviour and tests stay as they were.
   */
  wide?: boolean;
  children: ReactNode;
}>;

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true), () => setCopied(false));
  };
  return (
    <Button variant="ghost" size="md" iconOnly aria-label={copied ? "Link copied" : "Copy a link to this workflow"} icon={<Icon icon={Link2} />} onClick={copy} />
  );
}

function Powered({ by }: Readonly<{ by: string }>) {
  return (
    <p className="flex items-center gap-2 text-body-lg text-text-2">
      <KwCoin />
      Powered by <strong className="font-semibold text-text">{by}</strong>
    </p>
  );
}

export function WorkflowFrame({ title, lead, tone, poweredBy, example = 6, back = true, footer, after, wide = false, children }: FrameProps) {
  return (
    <div className="flex flex-col gap-6 pt-4">
      {back ? (
        <Link href={"/ai-studio" as Route} className="flex w-fit items-center gap-2 text-title text-text-2 no-underline live:hover:text-text">
          <Icon icon={ArrowLeft} />
          AI Studio
        </Link>
      ) : null}
      <div className={cx("grid overflow-hidden rounded-3xl border border-border bg-bg", !wide && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
        <section aria-labelledby="workflow-title" className={cx("flex min-w-0 flex-col border-border", !wide && "lg:border-r")}>
          <div className="flex flex-col gap-6 px-6 pt-10 pb-8 md:px-15">
            <header className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <h1 id="workflow-title" className="text-h1 text-text">
                  {title}
                </h1>
                <CopyLink />
              </div>
              <p className="text-body-lg text-muted">{lead}</p>
              {wide ? <Powered by={poweredBy} /> : null}
            </header>
            {children}
          </div>
          {footer ? <div className="sticky bottom-0 mt-auto border-t border-border bg-bg px-6 py-4 md:px-9">{footer}</div> : null}
        </section>
        {wide ? null : (
          <aside aria-label="Output example" className="flex min-w-0 flex-col items-center justify-center gap-4 p-6 md:p-10">
            <OutputExample tone={tone} count={example} />
            <Powered by={poweredBy} />
          </aside>
        )}
      </div>
      {after}
    </div>
  );
}

/** One numbered step of the form: "1. Upload your crest". */
export function Step({ number, label, htmlFor, error, children }: Readonly<{ number: number; label: string; htmlFor?: string; error?: string; children: ReactNode }>) {
  const heading = `${number}. ${label}`;
  return (
    <div className="flex flex-col gap-3">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-h3 text-text">
          {heading}
        </label>
      ) : (
        <h2 className="text-h3 text-text">{heading}</h2>
      )}
      {children}
      {error ? <p className="text-caption text-bad">{error}</p> : null}
    </div>
  );
}

type FooterProps = Readonly<{
  /** The image count, when the person chooses it. */
  count?: Readonly<{ value: number; min: number; max: number; onChange: (value: number) => void }>;
  /** The button's words, such as "Generate 4" or "Build my kits". */
  label: string;
  /** "Free", or the credits it will cost. */
  cost: string;
  /** Why it cannot be pressed yet, or null when it can. */
  blocked: string | null;
  pending: boolean;
  onGenerate: () => void;
}>;

/** The footer: the image count and Generate, with its cost on the button before anything is spent. */
export function GenerateFooter({ count, label, cost, blocked, pending, onGenerate }: FooterProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-text-2">
        <Icon icon={Images} />
        {count ? (
          <NumberInput label="How many" unit="" value={count.value} min={count.min} max={count.max} onChange={count.onChange} className="w-20" />
        ) : (
          <span className="text-body-lg" aria-label="Makes one set">
            1
          </span>
        )}
      </div>
      <Button variant="primary" size="lg" className="h-16 flex-1 text-h3" pending={pending} disabledReason={blocked ?? undefined} onClick={onGenerate}>
        {label} · {cost}
        <KwCoin />
      </Button>
    </div>
  );
}
