"use client";

import { Download, ExternalLink, FileDown, Sheet as SheetIcon } from "lucide-react";
import type { Route } from "next";
import { useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PremiumMark } from "@/components/ui/Marks";
import { Modal } from "@/components/ui/Modal";
import { cx } from "@/components/ui/cx";
import { useRoving } from "@/components/ui/use-roving";
import { openPlans } from "@/lib/plans/modal-store";
import type { Sheet, SheetBlock, SheetId, TechPackSheets } from "@/lib/techpack/editor/sheets";

/**
 * The tech pack sheets modal (spec 09 screen 31, references x01–x08): a spreadsheet-style preview of
 * the .xlsx the factory receives, one sheet tab per sheet, every sheet under the shared header.
 * Download .xlsx and PDF are ♛ while the brand's plan has no tech pack exports (`08` v3.7, P6's plan
 * data) and then open "Upgrade to export tech packs"; ordering through Knitwright never needs them.
 */

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
  sheets: TechPackSheets;
  fileName: string;
  /** Where the eight-sheet .xlsx and the PDF download from, or null in a preview with no design. */
  downloads: Readonly<{ xlsx: string; pdf: string }> | null;
  /** False while the plan has no tech pack exports: the downloads show ♛ and open the upgrade. */
  canExport: boolean;
  /** The Measurements sheet's front view with its points, drawn by the editor. */
  drawing?: ReactNode;
  /** The sheet to open on; Overview when not given. */
  sheet?: SheetId | undefined;
}>;

const COLUMNS = "ABCDEFGHIJKL".split("");

export function SheetsModal({ open, onClose, sheets, fileName, downloads, canExport, drawing, sheet: first }: Props) {
  const [at, setAt] = useState(() =>
    Math.max(
      0,
      sheets.sheets.findIndex((entry) => entry.id === first),
    ),
  );
  const sheet = sheets.sheets[at] ?? sheets.sheets[0];
  if (!sheet) return null;
  return (
    <Modal open={open} onClose={onClose} title={fileName} size="sheet">
      <div className="flex flex-col gap-3" data-testid="tp-sheets">
        <div className="flex flex-wrap items-center gap-3">
          <Icon icon={SheetIcon} size={20} className="text-ok" />
          <p className="mr-auto text-small text-muted">Preview of the file the factory receives</p>
          <DownloadButton label="Download .xlsx" icon={Download} href={downloads?.xlsx ?? null} canExport={canExport} testId="tp-download-xlsx" />
          <DownloadButton label="PDF" icon={FileDown} href={downloads?.pdf ?? null} canExport={canExport} testId="tp-download-pdf" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <div aria-hidden="true" className="grid grid-cols-12 border-b border-border bg-soft text-center text-micro text-muted uppercase">
            {COLUMNS.map((letter) => (
              <span key={letter} className="border-r border-border py-1 last:border-r-0">
                {letter}
              </span>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`tp-sheet-panel-${sheet.id}`}
            aria-labelledby={`tp-sheet-tab-${sheet.id}`}
            tabIndex={0}
            className="max-h-[56vh] overflow-y-auto bg-bg p-6"
            data-testid={`tp-sheet-${sheet.id}`}
          >
            <SheetHeader sheets={sheets} sheet={sheet} />
            {sheet.id === "measurements" && drawing ? <div className="mt-4 border border-text">{drawing}</div> : null}
            {sheet.blocks.map((entry, index) => (
              <Block key={`${entry.title}-${index}`} block={entry} />
            ))}
          </div>
          <SheetTabs sheets={sheets.sheets} at={at} onAt={setAt} />
        </div>
      </div>
    </Modal>
  );
}

type DownloadProps = Readonly<{
  label: string;
  icon: typeof Download;
  href: string | null;
  canExport: boolean;
  testId: string;
}>;

function DownloadButton({ label, icon, href, canExport, testId }: DownloadProps) {
  const classes = buttonClasses("secondary", false, "relative", "sm", false);
  if (canExport && href) {
    return (
      <a href={href as Route} download className={classes} data-testid={testId}>
        <Icon icon={icon} size={16} />
        {label}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openPlans({ kind: "techpack", plan: null })}
      className={classes}
      aria-label={`${label}, needs a plan with tech pack export`}
      data-testid={testId}
    >
      <Icon icon={icon} size={16} />
      {label}
      <PremiumMark label="Premium" />
    </button>
  );
}

function SheetHeader({ sheets, sheet }: Readonly<{ sheets: TechPackSheets; sheet: Sheet }>) {
  const brand = sheets.header.rows.find(([label]) => label === "Brand")?.[1] ?? "";
  const initials = brand
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex border border-text text-caption">
        <div className="flex w-36 flex-col border-r border-text">
          <p className="border-b border-text py-0.5 text-center font-bold">BRAND</p>
          <span className="m-auto grid size-18 place-items-center rounded-xl bg-navy text-h3 font-extrabold text-gold">{initials || "KW"}</span>
        </div>
        <table className="text-caption">
          <caption className="border-b border-text bg-text py-0.5 font-bold text-on-dark">PRODUCT DETAIL</caption>
          <tbody>
            {sheets.header.rows.map(([label, value]) => (
              <tr key={label} className="border-b border-text last:border-b-0">
                <th scope="row" className="w-40 border-r border-text px-1.5 py-0.5 text-left font-bold">
                  {label}:
                </th>
                <td className="px-1.5 py-0.5">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-end gap-4">
        <h3 className="text-h3 text-text">{sheet.title}</h3>
        <a href={sheets.header.openIn} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-text px-6 text-caption font-bold uppercase">
          Open in Knitwright
          <Icon icon={ExternalLink} size={14} />
        </a>
      </div>
    </div>
  );
}

function Block({ block }: Readonly<{ block: SheetBlock }>) {
  return (
    <table className="mt-4 w-full border border-text text-caption">
      <caption className="bg-text py-1 font-bold text-on-dark uppercase">{block.title}</caption>
      <thead>
        <tr className="bg-gold-soft">
          {block.columns.map((column, index) => (
            <th key={`${column}-${index}`} scope="col" className={cx("border border-text px-1.5 py-0.5 font-bold", index === block.highlight && "bg-gold")}>
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((text, index) => (
              <td
                key={index}
                className={cx(
                  "border border-text px-1.5 py-0.5",
                  index === block.highlight && "bg-gold-soft font-bold",
                  text === "Needs your input" && "text-warn",
                )}
              >
                {text}
              </td>
            ))}
          </tr>
        ))}
        {block.rows.length === 0 ? (
          <tr>
            <td colSpan={Math.max(1, block.columns.length)} className="border border-text px-1.5 py-1 text-muted">
              Nothing here yet.
            </td>
          </tr>
        ) : null}
      </tbody>
      {block.note ? (
        <tfoot>
          <tr>
            <td colSpan={Math.max(1, block.columns.length)} className="px-1.5 py-1 text-muted">
              {block.note}
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function SheetTabs({
  sheets,
  at,
  onAt,
}: Readonly<{
  sheets: readonly Sheet[];
  at: number;
  onAt: (index: number) => void;
}>) {
  const roving = useRoving<HTMLButtonElement>(sheets.length, onAt);
  return (
    <div role="tablist" aria-label="Sheets" className="flex overflow-x-auto border-t border-border bg-soft">
      {sheets.map((sheet, index) => (
        <button
          key={sheet.id}
          ref={roving.ref(index)}
          type="button"
          role="tab"
          id={`tp-sheet-tab-${sheet.id}`}
          aria-selected={index === at}
          aria-controls={index === at ? `tp-sheet-panel-${sheet.id}` : undefined}
          tabIndex={index === at ? 0 : -1}
          onClick={() => onAt(index)}
          onKeyDown={roving.onKeyDown(index)}
          className={cx(
            "border-r border-border px-5 py-2.5 text-body whitespace-nowrap",
            index === at ? "border-b-2 border-b-ok bg-bg font-semibold text-ok" : "text-text-2 live:hover:bg-bg",
          )}
          data-testid={`tp-sheet-tab-${sheet.id}`}
        >
          {sheet.name}
        </button>
      ))}
    </div>
  );
}
