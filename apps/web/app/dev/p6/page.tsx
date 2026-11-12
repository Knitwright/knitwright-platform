import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BrandEmpty } from "@/components/brand/v3/BrandEmpty";
import { BrandSideCard } from "@/components/brand/v3/BrandSideCard";
import { OverviewCards } from "@/components/brand/v3/OverviewCards";
import { StyleBanner } from "@/components/brand/v3/StyleBanner";
import { BrandTabs } from "@/components/brand-studio/BrandTabs";
import { SettingsCard } from "@/components/settings/v3/SettingsCard";
import { AppShell } from "@/components/shell/AppShell";
import { ApprovalCard } from "@/components/team/v3/ApprovalCard";
import { LinkTabs } from "@/components/team/v3/LinkTabs";
import { RosterTable } from "@/components/team/v3/RosterTable";
import { Button } from "@/components/ui/Button";
import { overviewCards } from "@/lib/brand-studio/overview-cards";
import { EMPTY_PROFILE, type BrandRecord } from "@/lib/brand-studio/types";
import { currentPlanLine } from "@/lib/plans/view";
import { rosterRows } from "@/lib/team/view";
import { unitSummary } from "@/lib/units/preference";
import { devRoutesEnabled } from "../dev-routes";
import { OpenPlans } from "./OpenPlans";

export const metadata: Metadata = { title: "P6 screens", robots: { index: false, follow: false } };

/**
 * Team, Brand, Settings and the plans modals with made-up data (decision 0144), for the 1440 × 900
 * comparison with d16–d19, e42 and s19 without a database. `?screen=` picks team, brand, brand-empty,
 * settings, plans or techpack. A production build answers 404 unless DEV_UI_ROUTES is "on".
 */

const SCREENS = ["team", "brand", "brand-empty", "settings", "plans", "techpack"] as const;
type Screen = (typeof SCREENS)[number];

const player = (id: string, name: string, number: string, sizeLabel: string) => ({ id, name, number, sizeLabel, wearerGroup: "unisex" as const });

const RECORD: BrandRecord = {
  brandId: "b",
  brandName: "Northfield FC",
  profile: {
    ...EMPTY_PROFILE,
    kind: "club",
    category: "club",
    about: "Grassroots football club, est. 1998. Green-and-gold hoops.",
    voiceTags: ["gritty", "community"],
    style: { setting: "Floodlit pitch", artDirection: "Grain", rulesBoundaries: "No neon" },
    defaultSizeRange: ["XS", "M", "3XL"],
  },
  palettes: [{ id: "p", name: "Primary", source: "brand-studio", colours: [{ id: "a", name: "Navy", hex: "#0b1f4b", pantoneTcx: null }, { id: "b", name: "Gold", hex: "#f2b705", pantoneTcx: null }, { id: "c", name: "White", hex: "#ffffff", pantoneTcx: null }] }],
  fonts: [{ role: "headline", fontKey: "geist" }, { role: "name_number", fontKey: "geist" }],
  assets: ["logo", "logo", "logo", "graphic", "crest", "label"].map((kind, index) => ({ id: `${index}`, kind: kind as BrandRecord["assets"][number]["kind"], artworkId: `${index}`, label: kind, sponsorName: null, printWidthMm: null, source: "brand-studio" as const })),
};

function Team() {
  const rows = rosterRows([player("1", "Smith", "7", "M"), player("2", "Khan", "10", "L"), player("3", "Jones", "1", "XL"), player("4", "Ahmed", "7", "S")], {
    rows: [{ key: "w", name: "Ali", requestId: "r", state: "missing", stateLabel: "Still waiting", entry: null, phone: "", email: "", flags: [] }],
    collected: 0,
    missing: 1,
    extra: 0,
    summary: "",
  });
  return (
    <div className="flex flex-col gap-6 pt-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-h1 text-text">Team · Northfield FC</h1>
        <div className="flex gap-3">
          <Button variant="secondary">Player sign-up link</Button>
          <Button variant="secondary">Import CSV</Button>
          <Button>Add player</Button>
        </div>
      </header>
      <LinkTabs label="Team" current="roster" tabs={[{ id: "roster", href: "/dev/p6" as Route, label: "Roster 2026/27" }, { id: "a", href: "/dev/p6" as Route, label: "Approvals" }, { id: "s", href: "/dev/p6" as Route, label: "Seasons" }]} />
      <RosterTable rows={rows} season="2026/27" signupHref={"/dev/p6" as Route} editHref={"/dev/p6" as Route} canEdit />
      <ApprovalCard design="Home kit" href={"/dev/p6" as Route} summary={{ line: "Version 3 3 votes · Version 4 1 vote · 4 comments · link expires in 26 days", pill: "3 approvals from 5", locked: false }} />
    </div>
  );
}

function Brand() {
  return (
    <div className="grid items-start gap-6 pt-2 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <h1 className="sr-only">Brand</h1>
      <BrandSideCard name="Northfield FC" about={RECORD.profile.about} website={null} percent={80} />
      <div className="flex min-w-0 flex-col gap-6">
        <StyleBanner set canEdit />
        <BrandTabs current="overview" />
        <OverviewCards cards={overviewCards(RECORD)} />
      </div>
    </div>
  );
}

function Settings() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <h1 className="text-h1 text-text">Settings</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <SettingsCard title="Plan & billing" summary={currentPlanLine(1240)}>
          <Button variant="secondary" size="sm">Get more credits</Button>
        </SettingsCard>
        <SettingsCard title="Members" summary="2 editors · 3 viewers" />
        <SettingsCard title="Units" summary={unitSummary("mm")} />
      </div>
    </div>
  );
}

const BODY: Readonly<Record<Screen, () => React.ReactNode>> = {
  team: Team,
  brand: Brand,
  "brand-empty": () => <BrandEmpty canEdit />,
  settings: Settings,
  plans: () => <OpenPlans kind="plans" />,
  techpack: () => <OpenPlans kind="techpack" />,
};

export default async function DevP6Page({ searchParams }: PageProps<"/dev/p6">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).screen;
  const screen = SCREENS.find((entry) => entry === asked) ?? "team";
  const Body = BODY[screen];
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Brand", workspace: { isClub: true, setUp: false }, credits: 1240 }}>
      <Body />
    </AppShell>
  );
}
