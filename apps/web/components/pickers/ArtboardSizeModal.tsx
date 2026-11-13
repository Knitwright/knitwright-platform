"use client";

import { File, RectangleHorizontal, RectangleVertical, Shirt, Smartphone, Square, SquarePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SplitModal } from "@/components/prompt-bar/SplitModal";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/Icon";
import { Checkbox, Select, TextInput } from "@/components/ui/Inputs";
import { PremiumMark } from "@/components/ui/Marks";
import { Tabs, tabPanelProps } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { boxOf } from "@/lib/canvas";
import { ARTBOARD_UNITS, type ArtboardPreset, type ArtboardUnit, type BoardView } from "@/lib/launch";
import { saveBoardAction } from "@/lib/launch/actions";
import {
  ARTBOARD_TAB_LABELS,
  ARTBOARD_TABS,
  artboardBody,
  checkSize,
  customOf,
  DEFAULT_CUSTOM,
  garmentBody,
  orientationOf,
  placeForNew,
  PREMIUM_TABS,
  presetsIn,
  sizeLine,
  withOrientation,
  type ArtboardTab,
  type CustomSize,
} from "@/lib/pickers";
import { listDesignChoicesAction, type DesignChoice } from "@/lib/pickers/actions";
import { openPlans } from "@/lib/plans/modal-store";

/**
 * CHOOSE ARTBOARD SIZE (plan v6 E5, decision 0149; `08` v3.2, v3.7 "Print on demand", prototype e02).
 *
 * Left: the tabs Popular · Products · Social · Marketing · Store · ♛ Print on demand, and a 3-column
 * grid of cards (icon, name, size). Right: Settings -- W and H, unit, DPI, orientation, margin -- and a
 * full-width **Create**. A preset card fills the settings; a **Products** card is one of the brand's
 * designs and adds a garment board at E1's garment box (`newBoardSize("garment")`). Every board is
 * added through the launch shell's own `saveBoardAction`, right of what is already on the canvas.
 */

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
  launchProjectId: string;
  presets: readonly ArtboardPreset[];
  boards: readonly BoardView[];
  /** Made-up designs for the /dev fixture. Real pages read them when the Products tab opens. */
  designs?: readonly DesignChoice[];
}>;

type Designs = Readonly<{ state: "loading" }> | Readonly<{ state: "error"; message: string }> | Readonly<{ state: "ready"; list: readonly DesignChoice[] }>;

const ID = "artboard-size";
const CARD = "flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-colors duration-fast";
const SHAPE = { portrait: RectangleVertical, landscape: RectangleHorizontal } as const;

export function ArtboardSizeModal({ open, onClose, launchProjectId, presets, boards, designs }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<ArtboardTab>("popular");
  const [size, setSize] = useState<CustomSize>(presets[0] ? customOf(presets[0]) : DEFAULT_CUSTOM);
  const [picked, setPicked] = useState<string | null>(presets[0]?.key ?? null);
  const [design, setDesign] = useState<DesignChoice | null>(null);
  const [list, setList] = useState<Designs>(designs ? { state: "ready", list: designs } : { state: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || tab !== "products" || designs) return;
    let live = true;
    listDesignChoicesAction({})
      .catch(() => null)
      .then((reply) => {
        if (!live) return;
        if (!reply) return setList({ state: "error", message: "Your designs could not be reached. Check your connection." });
        setList(reply.success ? { state: "ready", list: reply.data } : { state: "error", message: reply.error.message });
      });
    return () => {
      live = false;
    };
  }, [open, tab, designs]);

  const verdict = checkSize(size);
  const pickPreset = (preset: ArtboardPreset) => {
    setPicked(preset.key);
    setDesign(null);
    setSize(customOf(preset));
  };

  const create = async (): Promise<void> => {
    const at = placeForNew(boards.map(boxOf));
    let body;
    if (design) body = garmentBody(launchProjectId, design, at);
    else if (verdict.ok) body = artboardBody(launchProjectId, size, verdict.pixels, at);
    else return;
    setBusy(true);
    const reply = await saveBoardAction(body).catch(() => null);
    setBusy(false);
    if (!reply || !reply.success) {
      return void toast.show({ tone: "error", title: "The board was not added", body: reply ? reply.error.message : "Check your connection and try again." });
    }
    toast.show({ tone: "success", title: design ? "Garment board added" : "Artboard added", body: design ? `${design.name} is on the canvas.` : `${sizeLine(size.width, size.height, size.unit)} is on the canvas.` });
    router.refresh();
    onClose();
  };

  const cards = presetsIn(tab, presets);
  const settings = (
    <aside className="flex w-full flex-col gap-4 md:w-75" aria-label="Settings">
      <h3 className="text-h2 text-text">Settings</h3>
      {design ? (
        <p className="rounded-lg bg-soft p-3 text-body text-text-2">
          A garment board for <strong className="text-text">{design.name}</strong>. Its size is the garment&apos;s own.
        </p>
      ) : (
        <SizeFields size={size} onChange={(next) => {
            setPicked(null);
            setSize(next);
          }} />
      )}
      {!design && !verdict.ok ? (
        <p role="alert" className="text-small text-bad-strong">
          {verdict.reason}
        </p>
      ) : null}
      <Button className="mt-auto w-full" size="lg" disabled={busy || (!design && !verdict.ok)} onClick={() => void create()} data-testid="artboard-create">
        {busy ? "Creating…" : "Create"}
      </Button>
    </aside>
  );

  return (
    <SplitModal open={open} onClose={onClose} title="Choose Artboard Size" testId="artboard-size">
      <div className="flex min-h-0 flex-1 flex-col gap-6 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Tabs
            items={ARTBOARD_TABS.map((id) => ({ id, label: PREMIUM_TABS.includes(id) ? <span className="inline-flex items-center gap-1.5"><PremiumMark />{ARTBOARD_TAB_LABELS[id]}</span> : ARTBOARD_TAB_LABELS[id] }))}
            value={tab}
            onChange={(id) => setTab(id as ArtboardTab)}
            label="Artboard sizes"
            idBase={ID}
            className="flex-wrap"
          />
          <div {...tabPanelProps(ID, tab)} className="min-h-0 flex-1">
            {tab === "pod" ? (
              <PrintOnDemand />
            ) : tab === "products" ? (
              <ProductCards list={list} picked={design?.id ?? null} onPick={(one) => {
                  setDesign(one);
                  setPicked(null);
                }} />
            ) : (
              <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {tab === "popular" ? (
                  <li>
                    <button type="button" onClick={() => setTab("products")} className={cx(CARD, "w-full border-transparent bg-soft live:hover:border-border-strong")}>
                      <Icon icon={Shirt} size={22} className="size-10 text-text" />
                      <span className="text-body-lg font-semibold text-text">Kit design</span>
                      <span className="text-body text-muted">Garment board · pick a design</span>
                    </button>
                  </li>
                ) : null}
                {cards.map((preset) => (
                  <li key={preset.key}>
                    <button type="button" aria-pressed={picked === preset.key && design === null} onClick={() => pickPreset(preset)} title={preset.note} className={cx(CARD, "w-full", picked === preset.key && design === null ? "border-electric bg-bg" : "border-transparent bg-soft live:hover:border-border-strong")} data-preset={preset.key}>
                      <Icon icon={preset.unit !== "px" ? File : preset.width === preset.height ? Square : preset.width > preset.height ? RectangleHorizontal : Smartphone} size={22} className="size-10 text-text" />
                      <span className="text-body-lg font-semibold text-text">{preset.label}</span>
                      <span className="text-body text-muted">{sizeLine(preset.width, preset.height, preset.unit)}</span>
                    </button>
                  </li>
                ))}
                {cards.length === 0 && tab !== "popular" ? <li className="col-span-full text-body text-muted">No sizes in this group yet. A platform admin keeps the size list.</li> : null}
              </ul>
            )}
          </div>
        </div>
        {settings}
      </div>
    </SplitModal>
  );
}

function SizeFields({ size, onChange }: Readonly<{ size: CustomSize; onChange: (next: CustomSize) => void }>) {
  const number = (value: string): number => Number(value);
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-body-lg text-text">Size</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-small text-muted">
            W
            <TextInput inputMode="decimal" value={String(size.width)} onChange={(event) => onChange({ ...size, width: number(event.target.value) })} aria-label={`Width in ${size.unit}`} />
          </label>
          <label className="flex flex-col gap-1 text-small text-muted">
            H
            <TextInput inputMode="decimal" value={String(size.height)} onChange={(event) => onChange({ ...size, height: number(event.target.value) })} aria-label={`Height in ${size.unit}`} />
          </label>
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-body-lg text-text">
          Unit
          <Select value={size.unit} onChange={(event) => onChange({ ...size, unit: event.target.value as ArtboardUnit })}>
            {ARTBOARD_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-body-lg text-text">
          DPI
          <TextInput inputMode="numeric" value={String(size.dpi)} onChange={(event) => onChange({ ...size, dpi: number(event.target.value) })} />
        </label>
      </div>
      <div role="radiogroup" aria-label="Orientation" className="flex flex-col gap-2">
        <span className="text-body-lg text-text">Orientation</span>
        <div className="flex gap-2">
          {(["portrait", "landscape"] as const).map((one) => (
            <button key={one} type="button" role="radio" aria-checked={orientationOf(size) === one} aria-label={one === "portrait" ? "Portrait" : "Landscape"} onClick={() => onChange(withOrientation(size, one))} className={cx("grid size-11 place-items-center rounded-md border", orientationOf(size) === one ? "border-electric bg-electric-soft text-electric" : "border-border text-text-2")}>
              <Icon icon={SHAPE[one]} size={20} />
            </button>
          ))}
        </div>
      </div>
      <Checkbox label="Margin" checked={size.margin} onChange={(event) => onChange({ ...size, margin: event.target.checked })} />
    </>
  );
}

function ProductCards({ list, picked, onPick }: Readonly<{ list: Designs; picked: string | null; onPick: (design: DesignChoice) => void }>) {
  if (list.state === "loading") return <div aria-busy="true" aria-label="Loading your designs" className="grid grid-cols-3 gap-4">{[0, 1, 2].map((one) => <div key={one} className="skeleton-bar aspect-4/3 rounded-xl" />)}</div>;
  if (list.state === "error") return <p role="alert" className="text-body text-bad-strong">{list.message}</p>;
  if (list.list.length === 0) return <p className="text-body text-muted">You have no designs yet. Start one from Products or Create, and it appears here.</p>;
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {list.list.map((one) => (
        <li key={one.id}>
          <button type="button" aria-pressed={picked === one.id} onClick={() => onPick(one)} className={cx(CARD, "w-full", picked === one.id ? "border-electric bg-bg" : "border-transparent bg-soft live:hover:border-border-strong")} data-design={one.id}>
            <Icon icon={SquarePlus} size={22} className="size-10 text-text" />
            <span className="line-clamp-1 text-body-lg font-semibold text-text">{one.name}</span>
            <span className="text-body text-muted">{one.garment} · v{one.version}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PrintOnDemand() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl bg-gold-soft p-5">
      <PremiumMark label="Studio Pro" />
      <h4 className="text-title text-text">Kit print areas at production size</h4>
      <p className="text-body text-text-2">
        Print on demand lists each print area of a kit -- front crest, back number, sleeve, shorts leg -- at the size the factory prints it. It is a Studio Pro tab, and the print areas are not on this list yet, so there is nothing to pick on any plan for now.
      </p>
      <Button variant="premium" onClick={() => openPlans({ kind: "plans" })}>
        See plans
      </Button>
    </div>
  );
}
