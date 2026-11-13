import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { TechPackEditor } from "@/components/techpack-editor/TechPackEditor";
import { devArticles } from "@/lib/products/fixtures/dev";
import { SHEET_IDS, type SheetId } from "@/lib/techpack/editor/sheets";
import { editorTabOr } from "@/lib/techpack/editor/tabs";
import { fullDesign } from "@/lib/techpack/fixtures/designs";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Tech pack fixture", robots: { index: false, follow: false } };

/**
 * The tech pack editor and its sheets with made-up data (decision 0151), for the 1440 × 900
 * comparisons with s08–s15 and x01–x08:
 *
 *   ?tab=overview | body | measurements | materials | callouts | artworks | labels   (s08–s14)
 *   ?unit=in (s15) · ?sheet=overview | colourways | … | labels (x01–x08) · ?bare (no base article)
 *   · ?plan=paid (the downloads open instead of showing ♛)
 *
 * The base article is the launch catalogue's JSY-SS-01; the design and its header are made up and
 * say so. It reads nothing and needs no session; a production build answers 404 unless
 * DEV_UI_ROUTES is "on". Nothing pressed here is saved.
 */

const SPEC = () => fullDesign("team-jersey");

const HEADER = {
  styleName: "Lahore Lions Home Shirt 2027 (made up)",
  formName: null,
  brand: "Lahore Lions FC",
  collection: "Home kit",
  season: "2026/27",
  factory: null,
} as const;

const one = (value: string | string[] | undefined): string | null => (typeof value === "string" ? value : null);
const sheetOf = (value: string | null): SheetId | undefined => (SHEET_IDS as readonly string[]).includes(value ?? "") ? (value as SheetId) : undefined;

export default async function DevTechPackPage({ searchParams }: PageProps<"/dev/tech-pack">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const query = await searchParams;
  const article = query.bare !== undefined ? null : (devArticles().find((entry) => entry.code === "JSY-SS-01") ?? null);
  const unit = one(query.unit);
  const sheet = sheetOf(one(query.sheet));
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Lahore Lions FC", workspace: { isClub: true, setUp: true }, credits: 1240 }}>
      <div className="flex h-[min(56rem,88vh)] flex-col p-4">
        <TechPackEditor
          spec={SPEC()}
          article={article}
          header={HEADER}
          unit={unit === "mm" || unit === "in" ? unit : "cm"}
          tab={editorTabOr(one(query.tab))}
          {...(sheet === undefined ? {} : { openSheet: sheet })}
          onSave={null}
          busy={false}
          sheets={{
            date: "9 Nov 2026",
            openIn: "/dev/tech-pack",
            downloads: one(query.plan) === "paid" ? { xlsx: "#xlsx", pdf: "#pdf" } : null,
            canExport: one(query.plan) === "paid",
          }}
        />
      </div>
    </AppShell>
  );
}
