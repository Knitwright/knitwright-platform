import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GARMENT_BOX } from "@/lib/canvas";
import type { ArtboardPreset } from "@/lib/launch";
import { board, link, project } from "@/lib/launch/fixtures/canvas";
import { devRoutesEnabled } from "../dev-routes";
import { Fixture } from "./Fixture";
import { SHOWS, type Show } from "./shows";

export const metadata: Metadata = { title: "Prompt bar fixture", robots: { index: false, follow: false } };

/**
 * E5's prompt bar, pickers and panels with made-up data (decision 0149), for the 1440 × 900
 * comparisons with e02, e31–e34, e38–e40 and e44. `?show=` picks the state. It reads nothing and
 * needs no session; a production build answers 404 unless DEV_UI_ROUTES is "on".
 */

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const DESIGN = "00000000-0000-4000-8000-0000000000d1";
const NOTE = "Made-up size for the fixture.";

const PRESETS: readonly ArtboardPreset[] = [
  { key: "social-square-1-1", label: "Social square 1:1", width: 1080, height: 1080, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: NOTE },
  { key: "social-post-4-5", label: "Social post 4:5", width: 1080, height: 1350, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: NOTE },
  { key: "story-9-16", label: "Story 9:16", width: 1080, height: 1920, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: NOTE },
  { key: "hero-banner-16-9", label: "Hero banner 16:9", width: 1920, height: 1080, unit: "px", dpi: 72, ruleId: "R-GAP-000", note: NOTE },
  { key: "a4-print", label: "A4 print", width: 210, height: 297, unit: "mm", dpi: 300, ruleId: "R-GAP-000", note: NOTE },
];

const font = (key: string, label: string, family: string | null, selectable: boolean) => ({
  key,
  label,
  roleLabel: null,
  family,
  licenceNote: selectable ? "Made-up licence note for the fixture." : "Placeholder: no licence for a font of this kind is on file, so it cannot be chosen yet.",
  selectable,
});

export default async function DevPromptBarPage({ searchParams }: PageProps<"/dev/prompt-bar">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).show;
  const show: Show = (SHOWS as readonly string[]).includes(String(asked)) ? (asked as Show) : "prompt";
  const canvas = project(
    [
      board(id(1), "garment", { name: "Home kit v7 · JSY-SS-01", size: GARMENT_BOX, settings: { designProjectId: DESIGN }, inputVersion: 7 }),
      board(id(2), "mockup", { name: "Flat lay on grass", at: { x: 440, y: 0 } }),
      board(id(3), "ai_image", { name: "Floodlit pitch", at: { x: 800, y: 0 }, settings: { prompt: "Floodlit pitch at night, smoke and flare" } }),
    ],
    [link("e1", id(1), id(2)), link("e2", id(2), id(3))],
    { id: "00000000-0000-4000-8000-0000000000c1", name: "Lahore Lions · Home kit launch", designProjectId: DESIGN },
  );
  return (
    <main className="min-h-dvh bg-bg p-4">
      <Fixture
        show={show}
        project={canvas}
        presets={PRESETS}
        costs={{ perGeneratedBoard: 20, note: "Made-up prices for the fixture.", ruleId: "R-GAP-000" }}
        designs={[
          { id: DESIGN, name: "Home kit v7", garment: "Short-sleeve jersey", version: 7 },
          { id: "00000000-0000-4000-8000-0000000000d2", name: "Away kit v2", garment: "Short-sleeve jersey", version: 2 },
        ]}
        history={{
          current: 8,
          versions: [
            { version: 8, note: "", restoredFrom: null, createdAt: "2026-11-13T14:32:00Z" },
            { version: 7, note: "Sponsor moved", restoredFrom: null, createdAt: "2026-11-02T16:05:00Z" },
            { version: 6, note: "Collar changed", restoredFrom: null, createdAt: "2026-11-01T20:11:00Z" },
            { version: 5, note: "Autosave", restoredFrom: null, createdAt: "2026-11-01T18:40:00Z" },
            { version: 4, note: "Away colourway added", restoredFrom: null, createdAt: "2026-10-30T11:02:00Z" },
          ],
          statuses: { 7: "ordered", 6: "approved" },
          hasMore: false,
        }}
        fonts={[font("geist", "Geist Sans", "var(--font-sans)", true), font("geist-mono", "Geist Mono", "var(--font-mono)", true), font("placeholder-block", "Placeholder: wide block sans", null, false)]}
        brandFonts={[{ ...font("geist", "Geist Sans", "var(--font-sans)", true), key: "headline:geist", roleLabel: "Headline" }]}
        brandColours={[
          { key: "c1", name: "Club navy", paletteName: "Primary", hex: "#0b1f4b", safeHex: "#0b1f4b", inGamut: true, pantoneTcx: null, warning: null },
          { key: "c2", name: "Gold", paletteName: "Primary", hex: "#f2b705", safeHex: "#f2b705", inGamut: true, pantoneTcx: null, warning: null },
        ]}
      />
    </main>
  );
}
