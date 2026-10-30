"use client";

import { useId } from "react";
import {
  IMAGE_SIZES,
  IMAGE_TYPES,
  IMAGE_VIEWS,
  PATTERN_FORMATS,
  PATTERN_FORMAT_LABELS,
  PRINT_FILE_NOTE,
  RECOMMENDED_IMAGE_SIZE,
  RECOMMENDED_NOTE,
  TECH_PACK_SECTIONS,
  type ExportPanelTabId,
  type ImageOptions,
  type PatternOptions,
} from "@/lib/techpack/exports/panel";
import { EVERY_SECTION_NOTE } from "@/lib/techpack/exports/panel-outputs";

/**
 * The choices each export tab offers (spec F-S6). Every control here changes what the panel says
 * it would produce; there is no switch that moves without the answer moving, because a control
 * that changes nothing is a claim the platform cannot keep.
 */

export interface OptionState {
  readonly images: ImageOptions;
  readonly pattern: PatternOptions;
  readonly everySize: boolean;
}

type Props = Readonly<{
  tab: ExportPanelTabId;
  options: OptionState;
  onChange: (next: OptionState) => void;
}>;

const ROW = "flex flex-wrap items-center gap-2 text-[13px] text-ink";
const CHIP = "rounded-full border px-3 py-1 text-[12px]";
const chip = (on: boolean): string => `${CHIP} ${on ? "border-ink bg-tile-2 text-ink" : "border-white/20 text-chalk-muted"}`;
const NOTE = "text-[12px] leading-relaxed text-chalk-muted";

/** The sections of the tech pack, as a list of what the files hold. */
function Sections() {
  return (
    <div data-testid="export-sections">
      <p className={NOTE}>{EVERY_SECTION_NOTE}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {TECH_PACK_SECTIONS.map((section) => (
          <li key={section.id} className={`${CHIP} border-white/20 text-chalk-muted`}>
            {section.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The longest side of a picture, in pixels. The middle step is the one the specification recommends. */
function SizeSlider({ size, onSize }: Readonly<{ size: number; onSize: (size: number) => void }>) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-ink">
      Longest side: {size} pixels
      <input
        type="range"
        min={0}
        max={IMAGE_SIZES.length - 1}
        step={1}
        value={Math.max(0, IMAGE_SIZES.indexOf(size as (typeof IMAGE_SIZES)[number]))}
        onChange={(event) => onSize(IMAGE_SIZES[Number(event.target.value)] ?? RECOMMENDED_IMAGE_SIZE)}
      />
      <span className={NOTE}>{size === RECOMMENDED_IMAGE_SIZE ? RECOMMENDED_NOTE : `Sizes: ${IMAGE_SIZES.join(", ")} pixels.`}</span>
    </label>
  );
}

function Images({ options, onChange }: Props) {
  const { images } = options;
  const set = (patch: Partial<ImageOptions>) => onChange({ ...options, images: { ...images, ...patch } });
  const id = useId();
  return (
    <div className="flex flex-col gap-3" data-testid="export-images-options">
      <div role="radiogroup" aria-labelledby={`${id}-views`} className={ROW}>
        <span id={`${id}-views`} className={NOTE}>
          Views
        </span>
        {IMAGE_VIEWS.map((view) => (
          <button key={view} type="button" role="radio" aria-checked={images.view === view} className={chip(images.view === view)} onClick={() => set({ view })}>
            {view === "all" ? "All" : view[0]?.toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-types`} className={ROW}>
        <span id={`${id}-types`} className={NOTE}>
          File type
        </span>
        {IMAGE_TYPES.map((type) => (
          <button key={type} type="button" role="radio" aria-checked={images.type === type} className={chip(images.type === type)} onClick={() => set({ type })}>
            {type.toUpperCase()}
          </button>
        ))}
      </div>
      <SizeSlider size={images.size} onSize={(size) => set({ size })} />
      <label className={ROW}>
        <input type="checkbox" checked={images.withMannequin} onChange={(event) => set({ withMannequin: event.target.checked })} />
        Include mannequin
      </label>
      <label className={ROW}>
        <input type="checkbox" checked={images.withBackground} onChange={(event) => set({ withBackground: event.target.checked })} />
        Include background
      </label>
    </div>
  );
}

function Pattern({ options, onChange }: Props) {
  const { pattern } = options;
  const set = (patch: Partial<PatternOptions>) => onChange({ ...options, pattern: { ...pattern, ...patch } });
  const id = useId();
  return (
    <div className="flex flex-col gap-3" data-testid="export-pattern-options">
      <div role="radiogroup" aria-labelledby={`${id}-formats`} className={ROW}>
        <span id={`${id}-formats`} className={NOTE}>
          Export as
        </span>
        {PATTERN_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            role="radio"
            aria-checked={pattern.format === format}
            className={chip(pattern.format === format)}
            onClick={() => set({ format })}
          >
            {PATTERN_FORMAT_LABELS[format]}
          </button>
        ))}
      </div>
      <label className={ROW}>
        <input type="checkbox" checked={pattern.withArtwork} onChange={(event) => set({ withArtwork: event.target.checked })} />
        With pattern fills and graphics
      </label>
      <label className={ROW}>
        <input type="checkbox" checked={pattern.withMeasurements} onChange={(event) => set({ withMeasurements: event.target.checked })} />
        With measurements
      </label>
    </div>
  );
}

function PrintFiles({ options, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2" data-testid="export-print-options">
      <p className={NOTE}>{PRINT_FILE_NOTE}</p>
      <label className={ROW}>
        <input type="checkbox" checked={options.everySize} onChange={(event) => onChange({ ...options, everySize: event.target.checked })} />
        Every size, not just the one on the canvas
      </label>
    </div>
  );
}

/** The controls of one tab, or nothing for a tab that has none. */
export function TabOptions(props: Props) {
  switch (props.tab) {
    case "tech-pack":
      return <Sections />;
    case "images":
      return <Images {...props} />;
    case "pattern":
      return <Pattern {...props} />;
    case "print-files":
      return <PrintFiles {...props} />;
    default:
      return null;
  }
}
