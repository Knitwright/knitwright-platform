import { ARRANGEMENTS, type ArrangementName } from "./arrangements";
import type { MarketingFormat, MarketingGroup, MarketingLayout } from "./types";

/**
 * THE THIRTY LAYOUTS OF `07` (spec `docs/spec/07-template-library.md`, "Marketing templates"),
 * each at the formats that layout is for, which together are the **50 `templates` rows of kind
 * `marketing`** the spec counts (plan v5 L4, decision 0094).
 *
 * `07` names the layouts, not the rows: "kit countdown story (3, 2, 1)" is three stories, and the
 * acceptance test for F-L2 is a club making "a 'new kit' post in 3 formats", which is one layout at
 * three sizes. So a row is a layout at one format, the slug says which, and `counts.test.ts` reads
 * `07`'s own table and holds this file to every name in it and to the count of 50.
 *
 * Two names in `07` are not used as written, and both are owner decision 1 (the Store is a separate
 * platform): the group `07` calls "Team store" keeps its layouts -- they are posters, with no link,
 * no cart and no payment anywhere near them -- and "Etsy/Shopify banner" is seeded as "Web banner",
 * because a banner for a shop this platform does not run would name a shop nobody can reach. Both
 * are on the pull request.
 */

type Plan = Readonly<{
  key: string;
  title: string;
  group: MarketingGroup;
  lead: string;
  arrangement: ArrangementName;
  formats: readonly MarketingFormat[];
}>;

const SQUARE = "social-square-1-1";
const POST = "social-post-4-5";
const STORY = "story-9-16";
const WIDE = "hero-banner-16-9";
const A4 = "a4-print";

export const LAYOUT_PLANS: readonly Plan[] = [
  // Kit launch (`07`: "New kit" reveal post, home/away split, kit countdown story (3, 2, 1),
  // pre-order now, "Available now" with QR code).
  { key: "new-kit-reveal", title: "New kit reveal", group: "kit-launch", lead: "The new kit, large, with the words under it.", arrangement: "hero", formats: [SQUARE, POST, STORY] },
  { key: "home-away-split", title: "Home and away split", group: "kit-launch", lead: "Both shirts side by side, at the same size.", arrangement: "split", formats: [SQUARE, POST] },
  { key: "kit-countdown-3", title: "Kit countdown: 3", group: "kit-launch", lead: "Three days to go, with the number over the kit.", arrangement: "standout", formats: [STORY] },
  { key: "kit-countdown-2", title: "Kit countdown: 2", group: "kit-launch", lead: "Two days to go, with the number over the kit.", arrangement: "standout", formats: [STORY] },
  { key: "kit-countdown-1", title: "Kit countdown: 1", group: "kit-launch", lead: "One day to go, with the number over the kit.", arrangement: "standout", formats: [STORY] },
  { key: "pre-order-now", title: "Pre-order now", group: "kit-launch", lead: "The kit, the dates and a chip to point a phone at.", arrangement: "scanable", formats: [POST, STORY] },
  { key: "available-now-qr", title: "Available now, with a QR chip", group: "kit-launch", lead: "Out now, with a chip people can scan.", arrangement: "scanable", formats: [SQUARE, STORY] },

  // Club life (`07`: new signing, matchday, result, fixtures list, player of the match,
  // sponsor thank-you, training session announcement).
  { key: "new-signing", title: "New signing", group: "club-life", lead: "A new player in the kit, with their name and number.", arrangement: "portrait", formats: [SQUARE, STORY] },
  { key: "matchday", title: "Matchday", group: "club-life", lead: "Who, where and when, over the kit.", arrangement: "standout", formats: [SQUARE, STORY] },
  { key: "result", title: "Result", group: "club-life", lead: "The score, large, with the kit behind it.", arrangement: "standout", formats: [SQUARE, STORY] },
  { key: "fixtures-list", title: "Fixtures list", group: "club-life", lead: "The next few games as a list.", arrangement: "written", formats: [POST] },
  { key: "player-of-the-match", title: "Player of the match", group: "club-life", lead: "One player, their name and number, and a line about the game.", arrangement: "portrait", formats: [SQUARE, STORY] },
  { key: "sponsor-thank-you", title: "Sponsor thank-you", group: "club-life", lead: "The shirt with the sponsor on it, and your thanks.", arrangement: "hero", formats: [SQUARE, WIDE] },
  { key: "training-session", title: "Training session", group: "club-life", lead: "Training kit, the time and the place.", arrangement: "beside", formats: [POST] },

  // Team store (`07`: "Order your kit" with deadline, size reminder, last chance,
  // store closed / kits arriving). Posters only: no link, no cart, no payment (owner decision 1).
  { key: "order-your-kit", title: "Order your kit, with a deadline", group: "team-store", lead: "The kit, the closing date and a chip to scan.", arrangement: "scanable", formats: [SQUARE, POST, STORY] },
  { key: "size-reminder", title: "Size reminder", group: "team-store", lead: "How to pick a size, in a few lines.", arrangement: "written", formats: [STORY] },
  { key: "last-chance", title: "Last chance", group: "team-store", lead: "The closing date, large, over the kit.", arrangement: "standout", formats: [STORY] },
  { key: "kits-arriving", title: "Kits arriving", group: "team-store", lead: "Ordering has closed and the kits are on their way.", arrangement: "hero", formats: [SQUARE, STORY] },

  // Brand drop (`07`: drop announcement, product feature, size guide card, founder story, restock).
  { key: "drop-announcement", title: "Drop announcement", group: "brand-drop", lead: "The piece, the date and one line about it.", arrangement: "hero", formats: [SQUARE, POST, STORY] },
  { key: "product-feature", title: "Product feature", group: "brand-drop", lead: "The piece with three callouts: fabric, fit, features.", arrangement: "callouts", formats: [POST, WIDE] },
  { key: "size-guide-card", title: "Size guide card", group: "brand-drop", lead: "Your own size wording, as a card.", arrangement: "written", formats: [SQUARE, POST] },
  { key: "founder-story", title: "Founder story", group: "brand-drop", lead: "The piece beside a few lines in your own words.", arrangement: "beside", formats: [POST, STORY] },
  { key: "restock", title: "Restock", group: "brand-drop", lead: "Back in stock, with the piece large.", arrangement: "hero", formats: [SQUARE, STORY] },

  // E-commerce (`07`: product listing images (white background, 4:5), size chart image,
  // feature callout image, Etsy/Shopify banner -> seeded as a web banner; see the note above).
  { key: "listing-white", title: "Listing image on white", group: "e-commerce", lead: "The garment alone, nothing over it.", arrangement: "plain", formats: [SQUARE, POST] },
  { key: "size-chart-image", title: "Size chart image", group: "e-commerce", lead: "Your measurements as a plain card.", arrangement: "written", formats: [SQUARE] },
  { key: "feature-callout-image", title: "Feature callout image", group: "e-commerce", lead: "The garment with the features named beside it.", arrangement: "callouts", formats: [POST] },
  { key: "web-banner", title: "Web banner", group: "e-commerce", lead: "A wide banner for your own page.", arrangement: "beside", formats: [WIDE] },

  // Print (`07`: A4 poster, flyer, noticeboard QR poster for the clubhouse).
  { key: "a4-poster", title: "A4 poster", group: "print", lead: "A poster for a wall, at A4.", arrangement: "poster", formats: [A4] },
  { key: "flyer", title: "Flyer", group: "print", lead: "A handout with the features named.", arrangement: "callouts", formats: [A4] },
  { key: "noticeboard-qr-poster", title: "Noticeboard poster with a QR chip", group: "print", lead: "A poster for the clubhouse, with a chip to scan.", arrangement: "scanable", formats: [A4] },
];

/** The thirty layouts of `07`, each with its slots. Built the same way every time: no date, no random id. */
export const buildLayouts = (plans: readonly Plan[] = LAYOUT_PLANS): readonly MarketingLayout[] =>
  plans.map((plan) => ({
    key: plan.key,
    title: plan.title,
    group: plan.group,
    lead: plan.lead,
    formats: plan.formats,
    slots: ARRANGEMENTS[plan.arrangement](),
  }));
