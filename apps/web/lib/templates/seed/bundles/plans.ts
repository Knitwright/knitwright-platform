/**
 * The 15 kit bundle templates of `docs/spec/07-template-library.md` (plan v5 L8, decision 0098).
 *
 * A kit bundle is a set of design templates that belong together: the shirt and the shorts of one
 * kit, and the goalkeeper shirt where there is one. Every member names a design template in the
 * library by its slug, so a bundle can never point at a design that does not exist, and a bundle
 * holds no colour, no option and no measurement of its own — those live on the designs.
 *
 * `07` also asks a bundle for a sock colour. Socks are a garment type of the registry that the
 * catalogue maps to **no base article** (decision 0066), so there is no sock design template to put
 * in a bundle and none is invented: every bundle carries the socks gap below instead, with the gap
 * rule id, and it is listed in the pull request.
 */

export const BUNDLE_ROLES = ["home", "away", "goalkeeper", "training", "warm-up"] as const;
export type BundleRole = (typeof BUNDLE_ROLES)[number];

export const BUNDLE_SLOTS = ["shirt", "shorts", "trousers", "tee", "hoodie", "base-layer"] as const;
export type BundleSlot = (typeof BUNDLE_SLOTS)[number];

export interface BundleMemberPlan {
  /** The slug of a design template in the library. */
  readonly templateSlug: string;
  readonly role: BundleRole;
  readonly slot: BundleSlot;
}

export interface BundlePlan {
  readonly slug: string;
  readonly title: string;
  /** The first member is the bundle's lead: its sport, colour family and tags are the bundle's. */
  readonly members: readonly BundleMemberPlan[];
}

const member = (templateSlug: string, role: BundleRole, slot: BundleSlot): BundleMemberPlan => ({ templateSlug, role, slot });

export const BUNDLE_PLANS: readonly BundlePlan[] = [
  {
    slug: "red-white-club-kit",
    title: "Red and white club kit",
    members: [member("red-white-football-shirt", "home", "shirt"), member("red-white-stripe-football-shorts", "home", "shorts"), member("yellow-keeper-shirt", "goalkeeper", "shirt")],
  },
  {
    slug: "royal-white-club-kit",
    title: "Royal blue and white club kit",
    members: [member("royal-white-sleeve-football-shirt", "home", "shirt"), member("royal-white-stripe-football-shorts", "home", "shorts"), member("sky-band-collar-keeper-shirt", "goalkeeper", "shirt")],
  },
  {
    slug: "black-gold-away-kit",
    title: "Black and gold away kit",
    members: [member("black-gold-strip-football-shirt", "away", "shirt"), member("black-gold-football-shorts", "away", "shorts"), member("green-black-keeper-shirt", "goalkeeper", "shirt")],
  },
  {
    slug: "white-navy-club-kit",
    title: "White and navy club kit",
    members: [member("white-navy-classic-jersey", "home", "shirt"), member("white-navy-stripe-football-shorts", "home", "shorts")],
  },
  {
    slug: "navy-gold-club-kit",
    title: "Navy and gold club kit",
    members: [member("navy-gold-hoops", "home", "shirt"), member("navy-gold-football-shorts", "home", "shorts")],
  },
  {
    slug: "royal-fade-away-kit",
    title: "Royal blue fade away kit",
    members: [member("royal-white-gradient-fade-jersey", "away", "shirt"), member("royal-white-stripe-football-shorts", "away", "shorts")],
  },
  {
    slug: "navy-gold-spot-away-kit",
    title: "Navy and gold spot away kit",
    members: [member("navy-gold-spot-jersey", "away", "shirt"), member("navy-gold-football-shorts", "away", "shorts")],
  },
  {
    slug: "white-maroon-club-kit",
    title: "White club kit, maroon trim",
    members: [member("white-maroon-band-collar-football-shirt", "home", "shirt"), member("white-navy-stripe-football-shorts", "home", "shorts")],
  },
  {
    slug: "sky-blue-sash-club-kit",
    title: "Sky blue sash club kit",
    members: [member("sky-blue-sash", "home", "shirt"), member("white-navy-stripe-football-shorts", "home", "shorts")],
  },
  {
    slug: "black-minimal-gym-set",
    title: "Gym set, black with white binding",
    members: [member("black-white-minimal-compression-top", "training", "base-layer"), member("grey-black-training-shorts", "training", "shorts")],
  },
  {
    slug: "royal-white-cricket-set",
    title: "Royal blue and white cricket set",
    members: [member("royal-button-cricket-shirt", "home", "shirt"), member("navy-cricket-trousers", "home", "trousers")],
  },
  {
    slug: "maroon-gold-cricket-set",
    title: "Maroon and gold cricket set",
    members: [member("maroon-zip-cricket-shirt", "home", "shirt"), member("maroon-zip-pocket-cricket-trousers", "home", "trousers")],
  },
  {
    slug: "white-green-cricket-set",
    title: "White and green cricket set",
    members: [member("white-green-short-sleeve-cricket-shirt", "home", "shirt"), member("bottle-green-stripe-cricket-trousers", "home", "trousers")],
  },
  {
    slug: "navy-club-training-set",
    title: "Club training set, navy",
    members: [member("navy-white-club-training-hoodie", "training", "hoodie"), member("sky-white-chest-band-training-tee", "training", "tee"), member("grey-black-training-shorts", "training", "shorts")],
  },
  {
    slug: "black-grey-coaches-set",
    title: "Coaches' set, black and grey",
    members: [member("black-grey-coaches-hoodie", "training", "hoodie"), member("grey-black-coaches-v-neck-tee", "training", "tee"), member("grey-black-training-shorts", "training", "shorts")],
  },
];
