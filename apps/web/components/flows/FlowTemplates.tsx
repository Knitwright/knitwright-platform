"use client";

import { useState } from "react";
import { FLOW_TEMPLATES, notesOf, stepsOfSection, type FlowTemplateSpec } from "@/lib/flows";
import { BOARDS } from "@/lib/launch";
import { FlowThumbnail } from "./FlowThumbnail";

/**
 * THE SIX FLOW TEMPLATES OF `07`, with the affordances the spec asks for by name (F-L4): a
 * thumbnail board, a Watch tutorial card, yellow section labels and grey instruction notes beside
 * each step.
 *
 * Two of those need saying plainly rather than being drawn and left:
 *
 *   * **the tutorial card opens nothing**, because no film has been made. It says so instead of
 *     being a dead button;
 *   * **nobody has reviewed these packs.** `07` gives each one a list of steps and a count of
 *     assets; which scene each render uses and how the count splits are Knitwright's reading, and
 *     every card prints that note.
 *
 * On a phone the cards are one column and each pack's sections stack, which is the pattern the
 * launch shell already uses: everything below `lg` is a single column in reading order.
 */

export type FlowTemplatesProps = Readonly<{
  busy: boolean;
  /** Opens the pack on the canvas. The boards and the connectors are added on the server. */
  onOpen: (slug: string) => void;
}>;

const CHIP = "chip-btn inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-[13px] text-ink";

export function FlowTemplates({ busy, onOpen }: FlowTemplatesProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section aria-label="Flow templates" data-testid="flow-templates" className="flex min-h-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">Launch packs</h2>
        <p className="text-[13px] leading-relaxed text-ink-2">
          One design becomes a whole launch. Open a pack, put your design on its Design board and press Run all: every output is made in
          order, and the cost is shown before anything is spent.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {FLOW_TEMPLATES.map((spec) => (
          <li key={spec.slug}>
            <FlowTemplateCard spec={spec} busy={busy} open={open === spec.slug} onToggle={() => setOpen(open === spec.slug ? null : spec.slug)} onOpen={() => onOpen(spec.slug)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type CardProps = Readonly<{ spec: FlowTemplateSpec; busy: boolean; open: boolean; onToggle: () => void; onOpen: () => void }>;

function FlowTemplateCard({ spec, busy, open, onToggle, onOpen }: CardProps) {
  const paid = spec.steps.filter((step) => step.generation === "model").length;
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-white/12 bg-tile-2/80 p-3" data-testid={`flow-template-${spec.slug}`}>
      <FlowThumbnail spec={spec} />

      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-medium text-ink">{spec.title}</h3>
        <p className="text-[12px] leading-relaxed text-ink-2">{spec.lead}</p>
        <p className="font-mono text-[10px] tracking-[0.08em] text-ink-2 uppercase">
          {spec.assets} assets · {spec.steps.length} boards · {paid === 0 ? "all free" : `${paid} made by a model`}
        </p>
      </div>

      {/* The spec's "Watch tutorial" card. There is no film, and it says so. */}
      <div className="rounded-xl border border-white/10 bg-surface-solid/60 p-2.5" data-testid={`flow-tutorial-${spec.slug}`}>
        <p className="text-[12px] font-medium text-ink">{spec.tutorial.title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-2">{spec.tutorial.body}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-2">{spec.tutorial.note}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onOpen} className={CHIP} data-testid={`flow-template-open-${spec.slug}`}>
          Open this pack
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`flow-steps-${spec.slug}`}
          onClick={onToggle}
          className={CHIP}
          data-testid={`flow-template-steps-${spec.slug}`}
        >
          {open ? "Hide the steps" : "See the steps"}
        </button>
      </div>

      <div id={`flow-steps-${spec.slug}`} hidden={!open} className="flex flex-col gap-2.5">
        {spec.sections.map((section) => (
          <section key={section} className="flex flex-col gap-1.5">
            {/* The yellow section labels of F-L4, in the words 07 uses. */}
            <h4 className="self-start rounded-full border border-warn/30 bg-warn-wash px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] text-warn uppercase">
              {section}
            </h4>
            <ul className="flex flex-col gap-1">
              {stepsOfSection(spec, section).map((step) => (
                <li key={step.key} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-1">
                  <span className="text-[12px] text-ink">{step.name}</span>
                  <span className="font-mono text-[10px] text-ink-2">
                    {BOARDS[step.kind].label} · {step.format}
                    {step.generation === "model" ? " · credits" : " · free"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* The grey instruction notes of F-L4, each beside the step it belongs to. */}
        <ul className="flex flex-col gap-1" data-testid={`flow-notes-${spec.slug}`}>
          {notesOf(spec).map((note) => (
            <li key={note.key} className="rounded-xl border border-white/10 bg-surface-solid/40 px-2.5 py-1.5">
              <p className="text-[11px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink-2">{note.name}:</span> {note.note}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-2">{spec.note}</p>
    </article>
  );
}
