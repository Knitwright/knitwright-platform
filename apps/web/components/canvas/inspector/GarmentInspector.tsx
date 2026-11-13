"use client";

import { Check, CircleAlert, Clapperboard, FileText, ImagePlus, Info, Lock, Shirt, TriangleAlert, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { WhyButton } from "@/components/studio/editor/WhyButton";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Select, Toggle } from "@/components/ui/Inputs";
import { LinkButton } from "@/components/ui/LinkButton";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { boxOf } from "@/lib/canvas";
import { editorHref, optionsIn, parameterChange, swatchChange } from "@/lib/inspector/edits";
import { readGarmentInspectorAction } from "@/lib/inspector/actions";
import type { DesignChange, GarmentInspectorView, InspectorCheck, InspectorSlider } from "@/lib/inspector/types";
import type { BoardKind, BoardView, LaunchCommands } from "@/lib/launch";
import { applyDesignActionAction } from "@/lib/projects/actions";
import { ElementInspector } from "./ElementInspector";
import { useInspectorFixture } from "./fixtures";
import { ChoiceChip, ColourRow, Row, Section, ToolButton } from "./parts";
import { ProductInfoModal } from "./ProductInfoModal";

/**
 * THE GARMENT INSPECTOR (plan v6 E3, decision 0147; `08` §5.3 "Garment board", e15, e41).
 *
 * Product info, Product, Options, Colourways, Kit colours, Names & numbers, Size preview, Layers,
 * Checks (with Why?), Tools and Price, for the garment board selected on the canvas. It is the
 * primary way to change a garment on the canvas; the full editor stays one press away ("Open full
 * editor", focused mode), opened on the options, colourway and size shown here.
 *
 * It reads what it shows when the board is selected (`readGarmentInspectorAction`) and writes only
 * through the editor's own action (`applyDesignActionAction`): a change is applied by the garment
 * library, refused if the article does not offer it, stored as a version and validated by
 * `lib/validation`, and the canvas and this panel are read again. The Checks section is that stored
 * result; nothing here checks, softens or skips a rule.
 */

type Props = Readonly<{
  board: BoardView;
  designId: string | null;
  canvasId: string;
  busy: boolean;
  commands: LaunchCommands;
  /** The layer shown instead of the garment, or null for the garment itself. */
  elementId: string | null;
  onElement: (id: string | null) => void;
  /** For the fixture: open the Product info modal at once. */
  openInfo?: boolean;
}>;

type Load =
  | Readonly<{ state: "loading" }>
  | Readonly<{ state: "ready"; view: GarmentInspectorView }>
  | Readonly<{ state: "failed"; message: string; missing: boolean }>;

export function GarmentInspector({ board, designId, canvasId, busy, commands, elementId, onElement, openInfo = false }: Props) {
  const fixture = useInspectorFixture();
  const fixed = designId === null ? undefined : fixture?.garments[designId];
  const [load, setLoad] = useState<Load>(fixed ? { state: "ready", view: fixed } : { state: "loading" });
  const [colourwayId, setColourwayId] = useState<string | null>(null);
  // The options the address names (`opt=group:CODE`), as the editor keeps them, are where the inspector starts.
  const [options, setOptions] = useState<Readonly<Record<string, string>>>(() => (typeof window === "undefined" ? {} : optionsIn(window.location.search)));
  const [size, setSize] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);
  const [info, setInfo] = useState(openInfo || (fixture?.openInfo ?? false));

  // Bumped to read the design again: after a save, or when "Try again" is pressed.
  const [nonce, setNonce] = useState(0);
  const reread = (): void => setNonce((n) => n + 1);

  useEffect(() => {
    if (designId === null || fixed) return;
    // An answer that arrives after the person moved on (another board, another colourway) is dropped.
    let live = true;
    readGarmentInspectorAction({ designId, colourwayId: colourwayId ?? undefined, options }).then((reply) => {
      if (!live) return;
      if (reply.success) setLoad({ state: "ready", view: reply.data });
      else setLoad({ state: "failed", message: reply.error.message, missing: reply.error.code === "not_found" });
    });
    return () => {
      live = false;
    };
  }, [designId, fixed, colourwayId, options, nonce]);

  if (designId === null) {
    return (
      <div className="p-4">
        <Notice tone="warn">This garment board has no design behind it. Its design may have been removed.</Notice>
      </div>
    );
  }
  if (load.state === "loading") return <InspectorSkeleton />;
  if (load.state === "failed") {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="garment-inspector-error">
        <Notice tone="warn" role="alert">
          {load.message}
        </Notice>
        {load.missing ? null : (
          <Button variant="secondary" onClick={reread}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  const view = load.view;
  const locked = busy || saving;
  const fullEditor = editorHref(canvasId, board.id, view, { colourwayId, size });

  if (elementId !== null) {
    return <ElementInspector element={view.elementViews[elementId] ?? null} designId={view.designId} editorHref={fullEditor} onBack={() => onElement(null)} />;
  }

  /** One design change through the editor's own action; then the canvas and this panel are read again. */
  const apply = (change: DesignChange | null): void => {
    if (change === null) return;
    setProblem(null);
    if (fixed) return setProblem("This is a fixture with made-up data, so nothing is saved.");
    startSaving(async () => {
      const reply = await applyDesignActionAction({ projectId: view.designId, expectedVersion: view.version, action: change });
      if (!reply.success) setProblem(reply.error.message);
      reread();
    });
  };

  const addFrom = (kind: BoardKind): void => {
    const box = boxOf(board);
    commands.addBoard(kind, { x: box.x + box.width + 112, y: box.y }, board.id);
  };

  return (
    <div className="flex flex-col" data-testid="garment-inspector" aria-busy={saving}>
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <Button variant="secondary" icon={<Icon icon={Info} size={20} />} onClick={() => setInfo(true)} data-testid="product-info-open">
          Product info
        </Button>
        <LinkButton variant="secondary" href={fullEditor as Route}>
          Open full editor
        </LinkButton>
      </div>

      {problem ? (
        <div className="p-4 pb-0" data-testid="garment-inspector-problem">
          <Notice tone="warn" role="alert">
            {problem}
          </Notice>
        </div>
      ) : null}

      <Section title="Product" aside={<Link href={"/products" as Route} className="text-small font-semibold text-link">Change base</Link>}>
        <div>
          <p className="text-body-lg font-semibold text-text">{view.product.name}</p>
          <p className="text-caption text-muted" data-testid="garment-product-line">
            {view.product.line}
          </p>
        </div>
      </Section>

      <Section title="Options" testId="garment-options">
        {view.options.empty ? <p className="text-small text-muted">{view.options.empty}</p> : null}
        {view.options.groups.map((group) => (
          <div key={group.group} className="flex flex-col gap-1.5">
            <p id={`opt-${group.group}`} className="text-small text-text">
              {group.label}
            </p>
            <div role="radiogroup" aria-labelledby={`opt-${group.group}`} className="flex flex-wrap gap-1.5">
              {group.options.map((option) => (
                <ChoiceChip
                  key={option.code}
                  chosen={option.chosen}
                  disabled={locked}
                  onChoose={() => setOptions({ ...options, [group.group]: option.code })}
                  testId={`option-${group.group}-${option.code}`}
                >
                  {option.code} {option.label}
                  {option.locked ? (
                    <>
                      <Icon icon={Lock} size={14} className="text-gold-3" />
                      <span className="sr-only">, {option.lockNote ?? "not yet sampled"}</span>
                    </>
                  ) : null}
                </ChoiceChip>
              ))}
            </div>
            {group.options.some((option) => option.chosen && option.locked) ? (
              <LockLine note={group.options.find((option) => option.chosen)?.lockNote ?? null} ruleId={group.options.find((option) => option.chosen)?.ruleId ?? null} context={`option ${group.group}`} />
            ) : null}
          </div>
        ))}
        {view.options.sliders.map((slider) => (
          <Slider key={`${slider.key}:${slider.value}`} slider={slider} disabled={locked || view.article === null} onCommit={(value) => apply(parameterChange(view.article, slider, value))} />
        ))}
      </Section>

      <Section title="Colourways" aside={<Button variant="link" size="xs" disabled={locked} onClick={() => apply(view.colourways.add)} data-testid="colourway-new">+ New</Button>}>
        <Select aria-label="Colourway shown" value={view.colourway.id} disabled={locked} onChange={(event) => setColourwayId(event.target.value)} data-testid="colourway-select">
          {view.colourways.choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </Select>
      </Section>

      <Section title="Kit colours" testId="garment-kit-colours">
        {view.kitColours.map((row) => (
          <ColourRow key={row.id} row={row} busy={locked} onPick={(hex) => apply(swatchChange(view.colourway, row.id, hex))} />
        ))}
      </Section>

      <NamesNumbers view={view} locked={locked} apply={apply} />

      {view.sizes.sizes.length > 0 ? (
        <Section title="Size preview">
          <div role="radiogroup" aria-label="Size preview" className="flex flex-wrap gap-1.5">
            {view.sizes.sizes.map((one) => (
              <ChoiceChip key={one} chosen={(size ?? view.sizes.base) === one} onChoose={() => setSize(one)}>
                {one}
              </ChoiceChip>
            ))}
          </div>
          <p className="text-caption text-muted">The full editor opens at this size.</p>
        </Section>
      ) : null}

      {view.elements.length > 0 ? (
        <Section title="Layers" testId="garment-layers">
          <ul className="flex flex-col">
            {view.elements.map((element) => (
              <li key={element.id}>
                <button
                  type="button"
                  onClick={() => onElement(element.id)}
                  className="flex min-h-10 w-full items-center justify-between gap-2 rounded-sm px-2 text-left text-body text-text live:hover:bg-soft"
                  data-testid={`garment-layer-${element.id}`}
                >
                  <span className="min-w-0 truncate">{element.name}</span>
                  <span className="shrink-0 text-caption text-muted">{KIND_WORDS[element.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Checks view={view} />

      <Section title="Tools">
        <div className="flex flex-col gap-2">
          <ToolButton icon={<Icon icon={Shirt} size={20} />} disabled={locked} onClick={() => addFrom("mockup")} testId="garment-tool-mockup">
            Mockup
          </ToolButton>
          <ToolButton icon={<Icon icon={FileText} size={20} />} disabled={locked} onClick={() => addFrom("tech_pack")} testId="garment-tool-tech-pack">
            Tech pack
          </ToolButton>
          <ToolButton icon={<Icon icon={ImagePlus} size={20} />} disabled={locked} onClick={() => addFrom("ai_image")}>
            AI image board
          </ToolButton>
          <ToolButton icon={<Icon icon={Clapperboard} size={20} />} disabled={locked} onClick={() => addFrom("ai_video")}>
            AI video board
          </ToolButton>
        </div>
      </Section>

      <Section title="Price" testId="garment-price">
        <p className="text-small text-text" data-testid="garment-price-steps">
          {view.price.steps.map((step) => `${step.qty === 1 ? "1 pc" : `${step.qty}+`} ${step.unit ?? "not set"}`).join(" · ")}
        </p>
        <p className="text-caption text-muted">{view.price.from}</p>
        {view.price.labels.map((label) => (
          <p key={label} className="text-caption text-muted">
            {label}
          </p>
        ))}
        <LinkButton variant="premium" href={`/studio/${view.designId}/make` as Route} className="w-full">
          Order sample
        </LinkButton>
      </Section>

      <ProductInfoModal
        open={info}
        info={view.productInfo}
        onClose={() => setInfo(false)}
        onPreview={() => {
          setInfo(false);
          addFrom("mockup");
        }}
      />
    </div>
  );
}

const KIND_WORDS = { text: "Text", image: "Image", illustration: "Pattern fill", "player-mark": "Name & number" } as const;

function LockLine({ note, ruleId, context }: Readonly<{ note: string | null; ruleId: string | null; context: string }>) {
  return (
    <p className="flex items-center gap-1 text-caption text-muted">
      <Icon icon={Lock} size={14} className="text-gold-3" />
      {note ?? "Not yet sampled"}
      {ruleId ? <WhyButton ruleId={ruleId} context={context} /> : null}
    </p>
  );
}

function Slider({ slider, disabled, onCommit }: Readonly<{ slider: InspectorSlider; disabled: boolean; onCommit: (value: number) => void }>) {
  // Keyed on the stored value by its parent, so a save that moves the value starts this afresh.
  const [value, setValue] = useState(slider.value);
  const id = `slider-${slider.key}`;
  const commit = (): void => {
    if (value !== slider.value) onCommit(value);
  };
  return (
    <div className="flex flex-col gap-1" data-testid={`garment-slider-${slider.key}`}>
      <div className="flex items-center justify-between text-small">
        <label htmlFor={id} className="text-text">
          {slider.label}
        </label>
        <b className="text-text">{value === slider.value ? slider.valueText : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)} ${slider.unit}`}</b>
      </div>
      <input
        id={id}
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        disabled={disabled}
        aria-valuetext={`${slider.label} ${value} ${slider.unit}`}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-navy disabled:opacity-40"
      />
      <p className="flex flex-wrap items-center gap-1 text-caption text-muted">
        {slider.locked ? (
          <>
            <Icon icon={Lock} size={14} className="text-gold-3" />
            {slider.lockNote}
          </>
        ) : (
          slider.rangeText
        )}
        <WhyButton ruleId={slider.ruleId} context={`range ${slider.key}`} />
      </p>
    </div>
  );
}

function NamesNumbers({ view, locked, apply }: Readonly<{ view: GarmentInspectorView; locked: boolean; apply: (change: DesignChange | null) => void }>) {
  const marks = view.namesNumbers;
  if (!marks.available) {
    return (
      <Section title="Names & numbers">
        <p className="text-small text-muted">This garment has no place for player names or numbers.</p>
      </Section>
    );
  }
  return (
    <Section
      title="Names & numbers"
      testId="garment-names-numbers"
      aside={<Toggle label="Names and numbers" hideLabel checked={marks.on} disabled={locked} onChange={(on) => apply(on ? marks.turnOn : marks.turnOff)} />}
    >
      {marks.on ? (
        <>
          <Select aria-label="Lettering style" value={marks.styleId} disabled={locked} onChange={(event) => apply(marks.withStyle[event.target.value] ?? null)}>
            <option value="" disabled>
              Choose a lettering style
            </option>
            {marks.styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </Select>
          <Row label="Colour">{marks.colour || "Not set"}</Row>
          <Row label="Preview player">{marks.sample}</Row>
        </>
      ) : (
        <p className="text-small text-muted">Off. Turn it on to put player names and numbers in the garment&apos;s usual places.</p>
      )}
    </Section>
  );
}

const TONE_ICON = { ok: Check, warn: TriangleAlert, bad: X } as const;
const TONE_CLASS = { ok: "text-ok", warn: "text-warn", bad: "text-bad" } as const;
const TONE_WORDS = { ok: "Passed", warn: "Have a look", bad: "Must fix" } as const;

function Checks({ view }: Readonly<{ view: GarmentInspectorView }>) {
  const checks = view.checks;
  return (
    <Section title="Checks" aside={<span className="mr-auto text-small text-muted" data-testid="garment-checks-summary">{checks.summary}</span>} testId="garment-checks">
      {checks.lines.length === 0 ? (
        <p className="flex items-center gap-2 text-small text-muted">
          <Icon icon={CircleAlert} size={16} />
          This version has not been checked yet. Saving a change checks it.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {checks.lines.map((line) => (
            <CheckLine key={line.key} line={line} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function CheckLine({ line }: Readonly<{ line: InspectorCheck }>) {
  return (
    <li className="flex min-h-8 items-start gap-2 text-small" data-testid={`garment-check-${line.tone}`}>
      <Icon icon={TONE_ICON[line.tone]} size={16} className={cx("mt-0.5 shrink-0", TONE_CLASS[line.tone])} />
      <span className="min-w-0 flex-1 text-text">
        <span className="sr-only">{TONE_WORDS[line.tone]}: </span>
        {line.label}
        {line.target ? <span className="text-muted"> · {line.target}</span> : null}
      </span>
      {line.ruleId ? <WhyButton ruleId={line.ruleId} context={`check ${line.key}`} /> : null}
    </li>
  );
}

function InspectorSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="garment-inspector-loading" aria-busy="true" aria-label="Loading the garment">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
