# 0142: The Products area: catalogue, category, product page, configurator, My products, Trending ideas, Fabrics

Status: Accepted (plan v6, workstream P4)
Index: Accepted; /products replaces /catalogue, /catalogue/[code] and /brands/fabrics (308), Design this opens a configurator that makes the design on that base with its options, nothing priced or dated that no row holds
Index title: The Products area
Date: 2026-11-13
Plan step: v6 wave 2, P4. Builds on decisions 0137 (U1's components) and 0138 (the shell and route map); reads the catalogue of decision 0066, the factory model of 0071, the option code map of 0099 and the markets of 0104.

## Context

Build pack v3.9 (`09` screens 10, 11, 22, 26 and 28; prototype renders p01 to p05 and p08) puts Printify's catalogue
pages into the Kittl shell: a catalogue home, category pages, a product page with a Fulfilment box and a price ladder, a
product configurator, My products and Trending ideas, with Fabrics as a fourth tab. Until now `/products` was a 307
alias to the v2.2 catalogue (decision 0138), and its "New design" hand-off was a link to the blank new-design form that
asked for the garment again and carried no option.

## Decision

1. **Routes.** `/products` (Catalogue), `/products/mine`, `/products/trends`, `/products/fabrics`, and
   `/products/<slug>`, which is a product when the slug has the catalogue's code shape (`JSY-SS-01`, any case) and a
   category otherwise (`/products/football`, `/products/all`); anything else is 404. One dynamic segment serves both,
   as `09` gives both the shape `/products/:x`, and a code and a category word cannot be mistaken for each other.
   `/catalogue` → `/products`, `/catalogue/:code` → `/products/:code`, `/brands/fabrics` → `/products/fabrics` and
   `/catalogue?tab=templates` → `/templates` answer **308** (`lib/products/redirects.ts`, first in `next.config.ts`); the
   two temporary aliases of 0138 are deleted, and `/products` is in `FULL_WIDTH`. The rail's Products item opens
   `/products`.
2. **Tabs in the page, not the bar.** The prototype draws the title and the four underline tabs inside the page
   (p01, p05, p08), so they are there, as links with `aria-current="page"`; the top bar's centre stays empty, as in the
   renders.
3. **Categories are sports.** The prototype's tiles are Men's, Women's, Kids' and so on, but no base article holds a
   gender (decision 0090), so those tiles would all open empty pages. The categories are the sport tags the articles
   carry, with counts, plus "All products". Sub-category chips are the article types inside a category.
4. **Rows the data can answer.** Top picks for clubs = articles that serve teamwear; *From one piece* = articles whose
   capability takes an order of one (it stands where "New arrivals" is, which needs a launch date nobody keeps); Eco
   picks = fabrics the programme marks PFAS-free or with an OEKO-TEX certificate (none yet, so its Empty state shows);
   Discover more = article types. The questions are answered from the rows and name what is unset. Bestseller and New
   badges need sales counts and dates and are not drawn; "Frequently bought together" needs sales and is "For the same
   sports" instead.
5. **No invented number.** Prices come from the factory's tiers with their row labels; the Studio Pro price reads
   "Studio Pro price not set yet", because no plan discount is stored (01 says "up to 15%, to be confirmed"). The
   Fulfilment box's shipping is "Not set yet"; production shows the capability's lead time and, while QC days or the
   market's freight days are unset, "No delivery date yet. Not set: …" (decision 0104). Decoration tabs: sublimation
   reads from the fabric programme; embroidery, screen print and heat transfer say they are not agreed for the base.
6. **Design this.** The product page's **Design this** (and **Start designing** in the Fulfilment box) opens the
   configurator (p04): Made for, Fit, then the article's own option groups and length ranges. The default of each
   group can be picked; an option or length with no sample (`approved_by_sample_id` null) shows 🔒 with the reason and
   cannot be picked. **Create my design** calls `designFromBaseAction`, which checks every code again against the
   rows, makes the design on the article's registry type (`createProject`, as the new-design form does), applies the
   chosen options through the option code map as one version (`saveActions`), and opens `/studio/<id>`. A base with no
   garment type (FSH-MM-01) keeps the button visible and disabled with the reason. Length steps are shown for what the
   range allows; a sampled step other than the base length is set in the editor (E3), so it is not sent.
7. **Order swatch book** is a disabled button with its reason ("once checkout arrives"); so is **Connect a store** on
   My products. There is no form behind either until C1.
8. **My products** lists `brand_products` with chips by stage (idea, sample, run), not the prototype's listing
   states (Published, Drafts, Publishing errors, Archived), which do not exist before C1's sales channels; the channel
   column says "No sales channel yet". Each row opens its design and its samples and runs on `/orders/runs`.
9. **Trending ideas** are Knitwright's design templates (the library the inspiration board draws on, F-S1), by sport,
   in a masonry; a tile makes a copy through the template library's own action and opens the editor. Nothing records
   what is trending, so the page claims no ranking.
10. **Fabrics** is the v2.2 fabric library, unchanged in behaviour, under the Products tabs.
11. **States.** Loading skeletons (home, My products, Trending ideas, Fabrics), Empty (catalogue, no match, no products,
    no ideas, no eco fabric), Error (`products/error.tsx`, Retry and the reference). The product and category pages
    have no loading boundary so that an unknown code or category still answers 404. `/dev/products?view=` shows every
    page from fixture data with no database, for the 1440 × 900 comparison.

## Consequences

- `components/studio/home/{ArticleGrid,ArticleCard,ArticleSections,CatalogueFilters,CatalogueNav,MarketPanel,TemplatesTab}`
  are deleted; their behaviour lives in `components/products/`. `lib/home` keeps its catalogue reads, which
  `lib/products` builds on.
- Studio-home links, the sidebar and the search now point at `/products`, `/products/fabrics` and `/templates`.
- e2e: `products.spec.ts` replaces the catalogue and article-page parts of `studio-catalogue.spec.ts`; the founder
  journey now goes through **Design this**; `shell.spec.ts` and `fabrics.spec.ts` follow the new addresses.

## Owner questions

1. Studio Pro's discount on base prices: what figure, and where should it be stored (P6's plan rows)?
2. The category tiles: keep sports, or add Men's / Women's / Kids' once the articles carry a gender?
3. Should a design started from a product be listed on My products at once, or only when the brand lists it on
   Product runs, as today?
