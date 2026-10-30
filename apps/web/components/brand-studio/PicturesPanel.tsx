"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { saveBrandAssetsAction } from "@/lib/brand-studio/actions";
import { assetFindings, CHECKED_KINDS } from "@/lib/brand-studio/assets";
import { CLUB_KIT_NOTE } from "@/lib/brand-studio/club-kit";
import type { ArtworkFacts, AssetKind, BrandAsset } from "@/lib/brand-studio/types";
import { ASSET_KIND_LABELS, LIMITS } from "@/lib/brand-studio/words";
import { FindingList } from "./FindingList";

type Row = Readonly<{ artworkId: string; label: string; sponsorName: string; printWidthMm: string }>;
type Props = Readonly<{ kind: AssetKind; assets: readonly BrandAsset[]; uploads: readonly ArtworkFacts[]; canEdit: boolean }>;

const widthOf = (text: string): number | null => {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * One kind of brand picture, chosen from the brand's own uploads (F-S9 Logos, Graphics and
 * Sportswear). A crest, sponsor logo or label picture also gets the DPI check of `R-SUB-003`, which
 * never assumes a print width: it reports what the pixels allow until the brand types one.
 */
export function PicturesPanel({ kind, assets, uploads, canEdit }: Props) {
  const mine = assets.filter((asset) => asset.kind === kind && asset.source === "brand-studio");
  const readThrough = assets.filter((asset) => asset.kind === kind && asset.source === "club-kit");
  const [rows, setRows] = useState<readonly Row[]>(
    mine.map((asset) => ({
      artworkId: asset.artworkId,
      label: asset.label,
      sponsorName: asset.sponsorName ?? "",
      printWidthMm: asset.printWidthMm === null ? "" : String(asset.printWidthMm),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Readonly<{ tone: "ok" | "warn"; text: string }> | null>(null);
  const limit = LIMITS.assetsPerKind[kind];
  const checked = CHECKED_KINDS.some((entry) => entry === kind);

  const save = async () => {
    setBusy(true);
    const reply = await saveBrandAssetsAction({
      kind,
      assets: rows.map((row) => ({
        artworkId: row.artworkId,
        label: row.label,
        sponsorName: kind === "sponsor" ? row.sponsorName : "",
        printWidthMm: widthOf(row.printWidthMm),
      })),
    });
    setBusy(false);
    setNote(reply.success ? { tone: "ok", text: "Your pictures are saved." } : { tone: "warn", text: reply.error.message });
  };

  const findings = rows.flatMap((row) =>
    assetFindings({
      asset: {
        id: row.artworkId,
        kind,
        artworkId: row.artworkId,
        label: row.label,
        sponsorName: row.sponsorName === "" ? null : row.sponsorName,
        printWidthMm: widthOf(row.printWidthMm),
        source: "brand-studio",
      },
      artwork: uploads.find((upload) => upload.artworkId === row.artworkId) ?? null,
    }),
  );

  const setRow = (at: number, patch: Partial<Row>) => setRows(rows.map((row, index) => (index === at ? { ...row, ...patch } : row)));

  if (uploads.length === 0) {
    return (
      <Notice>
        Upload your {ASSET_KIND_LABELS[kind].toLowerCase()} in a design&apos;s artwork first, then choose it here.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {rows.map((row, at) => (
          <li key={at} className="grid gap-2 rounded-xl border border-hairline px-3 py-3">
            <select className={FIELD_CONTROL} disabled={!canEdit} value={row.artworkId} onChange={(event) => setRow(at, { artworkId: event.target.value })}>
              {uploads.map((upload) => (
                <option key={upload.artworkId} value={upload.artworkId}>
                  {upload.label} ({upload.kind === "vector" ? "drawing" : `${upload.widthPx} by ${upload.heightPx} pixels`})
                </option>
              ))}
            </select>
            <input
              className={FIELD_CONTROL}
              placeholder="Name"
              maxLength={LIMITS.assetLabel}
              disabled={!canEdit}
              value={row.label}
              onChange={(event) => setRow(at, { label: event.target.value })}
            />
            {kind === "sponsor" ? (
              <input
                className={FIELD_CONTROL}
                placeholder="Sponsor name"
                maxLength={LIMITS.sponsorName}
                disabled={!canEdit}
                value={row.sponsorName}
                onChange={(event) => setRow(at, { sponsorName: event.target.value })}
              />
            ) : null}
            {checked ? (
              <label className="flex flex-col gap-1">
                <span className="text-[13px] text-muted">How wide will it be printed, in millimetres? Leave it empty if you do not know yet.</span>
                <input
                  className={FIELD_CONTROL}
                  inputMode="decimal"
                  placeholder="mm"
                  disabled={!canEdit}
                  value={row.printWidthMm}
                  onChange={(event) => setRow(at, { printWidthMm: event.target.value })}
                />
              </label>
            ) : null}
            {canEdit ? (
              <div>
                <Button variant="quiet" type="button" onClick={() => setRows(rows.filter((_, index) => index !== at))}>
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {rows.length < limit ? (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRows([...rows, { artworkId: uploads[0]!.artworkId, label: uploads[0]!.label, sponsorName: "", printWidthMm: "" }])}
            >
              Add {ASSET_KIND_LABELS[kind].toLowerCase()}
            </Button>
          ) : (
            <p className="text-[13px] text-muted">A brand holds up to {limit} of those.</p>
          )}
          <Button type="button" pending={busy} onClick={() => void save()}>
            Save
          </Button>
        </div>
      ) : (
        <Notice>Your role can look at the brand but not change it.</Notice>
      )}

      <FindingList title={`What we noticed about your ${ASSET_KIND_LABELS[kind].toLowerCase()}`} findings={findings} />

      {readThrough.length === 0 ? null : (
        <section aria-label={`${ASSET_KIND_LABELS[kind]} from your club kit`} className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">From your club kit</p>
          <ul className="flex flex-col gap-1.5">
            {readThrough.map((asset) => (
              <li key={asset.id} className="text-[13px] text-muted">
                {asset.label}
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-muted">{CLUB_KIT_NOTE}</p>
        </section>
      )}

      {note ? (
        <Notice tone={note.tone} role={note.tone === "warn" ? "alert" : "status"}>
          {note.text}
        </Notice>
      ) : null}
    </div>
  );
}
