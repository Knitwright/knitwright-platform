import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { DropList, NewDropForm, SendBatchesButton } from "@/components/storefront/DropsPanel";
import { ListingEditor } from "@/components/storefront/ListingEditor";
import { BuyForm } from "@/components/storefront/shop/BuyForm";
import { ShopFrame } from "@/components/storefront/shop/ShopFrame";
import { StorefrontSettingsForm } from "@/components/storefront/StorefrontSettingsForm";
import { registryTypeForBaseArticle } from "@/lib/catalogue";
import { renderOf } from "@/lib/products/render";
import { dropCards } from "@/lib/storefront/drops";
import { FLOW_ITEM, SIZES, sampleDrop, sampleLadder, sampleListing, sampleStorefront } from "@/lib/storefront/fixtures/samples";
import { mediaPool } from "@/lib/storefront/media";
import { gpsrRows } from "@/lib/storefront/policy";
import { unitCost } from "@/lib/storefront/pricing";
import { storefrontDefaults } from "@/lib/storefront/settings";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Storefront screens", robots: { index: false, follow: false } };

/**
 * C3's screens with made-up data (decision 0154), without a database: `?screen=` picks editor (the listing editor,
 * 09 screen 23, for the comparison with p06), viewer (the same, read-only), settings (the brand's storefront page:
 * settings, drops, batches) or shop (the public storefront's product page). A production build answers 404 unless
 * DEV_UI_ROUTES is "on".
 */

const SCREENS = ["editor", "viewer", "settings", "shop"] as const;
type Screen = (typeof SCREENS)[number];

const NOW = new Date("2026-11-13T12:00:00.000Z");

function sources(): Readonly<Record<string, string>> {
  const render = renderOf(registryTypeForBaseArticle("JSY-SS-01"));
  return render ? { "render-front": render.src, [FLOW_ITEM.id]: render.src } : {};
}

function Editor({ canEdit }: Readonly<{ canEdit: boolean }>) {
  const listing = sampleListing();
  return (
    <ListingEditor
      listing={listing}
      productName="Example FC Home Shirt 2027"
      editDesignHref="/projects/recent"
      sizes={SIZES}
      fabrics={["mesh-140", "interlock-160"]}
      cost={unitCost(sampleLadder, "GBP")}
      facts={{ stage: "run", hasRelease: true, productionClass: "A", euResponsiblePerson: null, storefrontLive: true }}
      gpsr={gpsrRows({ factory: { name: "Example partner factory", country: "Sialkot, PK" }, euResponsiblePerson: null })}
      pool={mediaPool([FLOW_ITEM], true)}
      sources={sources()}
      canEdit={canEdit}
      improvePrice={1}
    />
  );
}

function Settings() {
  const drops = [sampleDrop(), sampleDrop({ id: "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a", name: "Away kit drop", opensAt: "2026-11-20T10:00:00.000Z", closesAt: "2026-11-27T10:00:00.000Z", targetUnits: null })];
  return (
    <div className="flex flex-col gap-6 pt-6">
      <StorefrontSettingsForm initial={storefrontDefaults(sampleStorefront(), "Example FC", "example-fc")} canEdit />
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5">
        <h2 className="text-h3 text-text">Drops</h2>
        <NewDropForm plans={[{ id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b", name: "2027 range" }]} canEdit />
        <DropList drops={dropCards(drops, new Map([[drops[0]!.id, 18]]), NOW)} canEdit />
        <DropList drops={[]} canEdit />
      </section>
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-5">
        <h2 className="text-h3 text-text">Batches</h2>
        <SendBatchesButton canEdit next="Monday at 12:00 Pakistan time" />
        <SendBatchesButton canEdit={false} next="Monday at 12:00 Pakistan time" />
      </section>
    </div>
  );
}

function Shop() {
  const listing = sampleListing();
  const src = sources()["render-front"];
  return (
    <ShopFrame name="Example FC shop" slug="example-fc" accent={null}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="grid aspect-square place-items-center rounded-xl bg-soft">
          {/* eslint-disable-next-line @next/next/no-img-element -- A render made on the server. */}
          {src ? <img src={src} alt="Product render" className="max-h-full max-w-full object-contain" /> : null}
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="text-h1 text-text">{listing.title}</h1>
          <BuyForm slug="example-fc" listingId={listing.id} currency="GBP" prices={listing.prices} sizes={SIZES} personalisation={listing.personalisation} onSale closedReason="" />
          <BuyForm slug="example-fc" listingId={listing.id} currency="GBP" prices={listing.prices} sizes={SIZES} personalisation={listing.personalisation} onSale={false} closedReason="This drop opens 20 Nov, 10:00 – 27 Nov, 10:00 UTC." />
        </div>
      </div>
    </ShopFrame>
  );
}

const BODY: Readonly<Record<Screen, () => ReactNode>> = {
  editor: () => <Editor canEdit />,
  viewer: () => <Editor canEdit={false} />,
  settings: Settings,
  shop: Shop,
};

export default async function DevStorefrontPage({ searchParams }: PageProps<"/dev/storefront">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).screen;
  const screen = SCREENS.find((entry) => entry === asked) ?? "editor";
  if (screen === "shop") return BODY.shop();
  return <AppShell data={{ email: "ana@example.test", brandName: "Brand", workspace: { isClub: false, setUp: true }, credits: 1240 }}>{BODY[screen]()}</AppShell>;
}
