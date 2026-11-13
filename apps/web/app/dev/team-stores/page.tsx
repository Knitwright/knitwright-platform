import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { PageIntro } from "@/components/shell/PageIntro";
import { BuyForm } from "@/components/team-stores/BuyForm";
import { ClubPageForm } from "@/components/team-stores/ClubPageForm";
import { OpenStoreForm } from "@/components/team-stores/OpenStoreForm";
import { StoreCardView } from "@/components/team-stores/StoreCardView";
import { Notice } from "@/components/ui/Notice";
import { FIXTURE_LADDER, NOW, fixturePurchase, fixtureStore } from "@/lib/team-stores/fixtures/stores";
import { buyerOutcome } from "@/lib/team-stores/receipt";
import { piecePriceMinor } from "@/lib/team-stores/rules";
import { storeCard } from "@/lib/team-stores/view";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Team store screens", robots: { index: false, follow: false } };

/**
 * C2's screens with made-up stores (decision 0153), without a database: `?screen=` picks cards (a store card in
 * every state), open (the Order drawer's Open a team store form, priced and unpriced), buy (a buyer's order form)
 * or receipt (every state of the buyer's return page) and the club page settings. A production build answers 404
 * unless DEV_UI_ROUTES is "on".
 */

const SCREENS = ["cards", "open", "buy", "receipt"] as const;
const SITE = "https://knitwright.example";

const STATES = [
  fixtureStore({ opensAt: "2026-11-20T00:00:00.000Z", closesAt: "2026-11-30T23:59:59.000Z", title: "Away kit (opens soon)" }),
  fixtureStore(),
  fixtureStore({ status: "closed", piecesSold: 18, marginOwedMinor: 5220, orderId: "00000000-0000-4000-8000-000000000123", title: "Training tees" }),
  fixtureStore({ status: "refunded", piecesSold: 6, marginBps: 0, marginMinor: 0, closeMessage: "The store closed with 6 of the 10 pieces it needed, so everyone who paid is refunded.", title: "GK kit" }),
];

function Cards() {
  const bought = [fixturePurchase(), fixturePurchase({ pieces: 2, lines: [{ sizeLabel: "S", printName: "ALI", printNumber: "7" }, { sizeLabel: "L", printName: "", printNumber: "" }] })];
  return (
    <div className="grid max-w-4xl gap-4 pt-4 lg:grid-cols-2">
      {STATES.map((store) => (
        <StoreCardView key={store.title} card={storeCard(store, bought, NOW, SITE)} canEdit />
      ))}
      <StoreCardView card={storeCard(fixtureStore(), [], NOW, SITE)} canEdit={false} />
    </div>
  );
}

function Open() {
  return (
    <div className="flex max-w-md flex-col gap-8 pt-4">
      <OpenStoreForm projectId="00000000-0000-4000-8000-000000000c01" designName="Lions home kit" sizeRun={["XS", "S", "M", "L", "XL", "2XL"]} ladder={FIXTURE_LADDER} seasons={[{ id: "00000000-0000-4000-8000-000000000501", name: "2026/27" }]} onOpened={() => undefined} />
      <OpenStoreForm projectId="00000000-0000-4000-8000-000000000c01" designName="Unpriced design" sizeRun={["S", "M"]} ladder={[]} seasons={[]} onOpened={() => undefined} />
    </div>
  );
}

function Buy() {
  const store = fixtureStore();
  return (
    <div className="flex max-w-md flex-col gap-4 pt-4">
      <PageIntro eyebrow="Lahore Lions · Team store" title={store.title} lead="£31.90 a piece · Closes in 8 days" />
      <BuyForm store={{ code: store.code, currency: store.currency, pieceMinor: piecePriceMinor(store), sizes: store.sizes, namesNumbers: true, nameMax: 12, numberMin: 0, numberMax: 99 }} siteKey="1x00000000000000000000AA" />
    </div>
  );
}

function Receipt() {
  const store = fixtureStore();
  const cases = [
    buyerOutcome({ status: "fulfilled", amountMinor: 3190, refundedMinor: 0 }, false, store),
    buyerOutcome({ status: "open", amountMinor: 3190, refundedMinor: 0 }, false, store),
    buyerOutcome({ status: "open", amountMinor: 3190, refundedMinor: 0 }, true, store),
    buyerOutcome({ status: "fulfilled", amountMinor: 3190, refundedMinor: 0 }, false, { ...store, status: "refunding" }),
    buyerOutcome({ status: "refunded", amountMinor: 3190, refundedMinor: 3190 }, false, store),
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-6 pt-4">
      {cases.map((outcome) => (
        <section key={outcome.title} className="flex flex-col gap-2">
          <h2 className="text-h2 text-text">{outcome.title}</h2>
          <Notice tone={outcome.tone}>{outcome.body}</Notice>
        </section>
      ))}
      <ClubPageForm page={null} suggested="lahore-lions-fc" rootDomain="knitwright.com" />
      <ClubPageForm page={{ slug: "lahore-lions-fc", contact: "kit@lahorelions.example", published: true, address: "https://lahore-lions-fc.knitwright.com" }} suggested="lahore-lions-fc" rootDomain={null} />
    </div>
  );
}

const BODY = { cards: Cards, open: Open, buy: Buy, receipt: Receipt } as const;

export default async function DevTeamStoresPage({ searchParams }: PageProps<"/dev/team-stores">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).screen;
  const Body = BODY[SCREENS.find((entry) => entry === asked) ?? "cards"];
  return (
    <AppShell data={{ email: "ana@example.test", brandName: "Lahore Lions", workspace: { isClub: true, setUp: true }, credits: 1240 }}>
      <Body />
    </AppShell>
  );
}
