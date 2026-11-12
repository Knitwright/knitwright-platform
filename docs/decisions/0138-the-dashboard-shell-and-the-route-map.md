# 0138: The dashboard shell and the v3.9 route map

Status: Accepted (plan v6, workstream U2)
Index: Accepted; the 96 px rail, the 76 px top bar and the help bubble replace decision 0103's glass top bar, runs move to /orders/runs and /brand goes to Brand Studio, ten placeholder routes, every v2.2 page keeps a door
Index title: The dashboard shell and the route map
Date: 2026-11-13
Plan step: v6 wave 1, U2. Builds on decision 0137 (U1's tokens and components). Supersedes decision 0103's top bar.

## Context

Build pack v3.9 copies Kittl's dashboard: a narrow left rail of icon-and-label items, a top bar inside each page with
the brand, the page's tabs and the account, and a gold help bubble (`docs/spec/09-screen-map.md` "Global shell", `10`
§4 for the sizes, `prototype-screens/d01-projects.png` for the picture). The v2.2 studio had a glass pill bar at the
top with eleven sections, four as pills and seven in a More menu (decision 0103). Most v3.9 routes do not exist yet;
wave 2 builds them.

## Decision

1. **The shell** (`components/shell/AppShell.tsx`, drawn by `app/(app)/layout.tsx`):
   - **Rail**, 96 px, white with a right border: the logo, **Create** (a navy square opening a menu to its right),
     AI Studio, Templates, Mockups, Marketing, Products, Projects, **⌄** (Orders, Store, and Team for a club), then at
     the foot Help, **⋯** and the square workspace avatar. Each item is a 22 px icon in a 44 px rounded square over a
     12 px label; the current item's square is `soft-2` and its link carries `aria-current="page"`. ⌄ is a disclosure
     and is open whenever the current page is inside it.
   - **Top bar**, 76 px (`10` §4 and the prototype; `09` says 72, and the reference image is 76): the brand pill
     (briefcase, the brand's name, gold **New** until the brand is set up; it opens Brand Studio), a centre slot the
     page fills with its tabs or its title, **⊕** (Invite people, Add credits with the balance), **Upgrade** (navy with
     the KW coin) and the round account avatar.
   - **Help bubble**, gold, bottom right, opening a message to the team. It has no red dot, because there is no inbox
     to be unread; it is left off a design or launch canvas, whose corner holds the canvas's own controls.
   - **Phone** (below 768 px): the rail is hidden and the top bar starts with one Menu holding Create's entries, every
     place, the workspace pages and Help. `10` §4 asks the dashboard to work down to 1024 px with the rail kept; the
     phone layout is for the club and parent journeys that pass through signed-in pages.
   - **Canvas** (the design editor and the launch canvas, `/studio/<id>/…` and `/launch/<id>/…`): no rail and no
     help bubble at any width, and the top bar's Menu holds the places. `10` §4 gives the editor its own chrome and a
     1280 px minimum, and with the rail beside it the launch canvas's centre column fell to 360 px at 1280, so its
     dock covered its own boards (the first CI run of this change showed it). E1 replaces this with the editor's rail.
2. **Menus.** Create, ⋯, the workspace avatar, ⊕, the account avatar and the phone Menu are one component,
   `ShellMenu`: U1's `Menu` (panel, keys, dismissal) with a caller-drawn trigger and link entries, so a place opens
   by ordinary navigation. Enter, Space and ↓ open on the first entry, ↑ on the last; the arrows, Home and End move
   and wrap; Esc closes and returns focus to the trigger; Tab closes. A rail menu's panel is fixed to the window
   beside its trigger, because the rail scrolls on a short window when ⌄ is open and a scrolling box clips its
   children. The account menu keeps decision 0103's three things: the address, Settings, Sign out.
3. **The page tabs slot.** A page puts `TopBarTabs` or `TopBarTitle` (`components/shell/TopBarSlot.tsx`) anywhere in
   its tree and it is drawn into the bar's centre through a portal. The title in the bar is for the eye; the page
   keeps its own h1 (`md:sr-only`), so it is in the server's HTML and on a phone, where the bar has no centre.
4. **The Create menu** lists `09` screen 1's items that have something behind them: New kit design (`/studio/start`,
   templates first), Kit from crest (`/crest-to-kit`), Social post (`/launch`), Explore templates (`/templates`),
   Blank canvas (`/studio/new`). Video, Mockup, Tech pack and Import design are left out rather than shown dead: the
   first two have no page of their own outside a launch canvas, and a tech pack and an imported design both need a
   design first and are reached from inside one.
5. **Club.** A workspace is a club when its welcome-page answer was a club or a school, or its Brand Studio category
   makes it one. Team shows on the rail for a club only. Members and roles are on the club page for every brand, so a
   brand that is not a club reaches it from ⋯ ("Club and members") and from ⊕ "Invite people".
6. **Set up.** The brand pill's gold New shows until Brand Studio's details step is done (the brand has said what it
   is). The v2.2 completion pill and credits chip are gone from the bar: the New tag and the balance in ⊕ replace them.
7. **Frames.** The v3.9 placeholder pages take the full width with `10` §4's padding. The v2.2 pages keep the 1110 px
   column they were laid out for (`lib/shell/frame.ts`), so none stretches across a wide screen before its wave-2
   rebuild; a workstream adds its prefix to `FULL_WIDTH` when it rebuilds its page. The editor and launch canvas break
   out of the column to nearly the window's width; they now measure against `--shell-vw` (the window less the rail)
   rather than `100vw`, or they would run under the rail and past the window by half its width.

### The route map

| v3.9 route | Today | Rail item points at | Moved by |
|---|---|---|---|
| `/projects` | 307 to `/studio` (the studio home) | `/studio` | P1 |
| `/ai-studio` (+ `/workflows`, `/workflow/[id]`, `/agent`, `/image`, `/video`) | placeholders, with AI Studio's four tabs | `/ai-studio` | P3 |
| `/templates` | the v2.2 templates page | `/templates` | P2 |
| `/mockups` | placeholder (opens Launch) | `/mockups` | P2 |
| `/marketing` | placeholder (opens Launch) | `/marketing` | P2 |
| `/products`, `/products/[code]` | 307 to `/catalogue`, `/catalogue/[code]` | `/catalogue` | P4 |
| `/orders` | placeholder with tabs Orders, Product runs | `/orders` | P5 |
| `/orders/runs` | the v2.2 product-runs page, moved from `/brand` | (tab of Orders) | P5 |
| `/store` | placeholder | `/store` | C1–C5 |
| `/team` | 307 to `/club` | `/club` (clubs) | P6 |
| `/brand` | 307 to `/brand-studio` | brand pill → `/brand-studio` | P6 |
| `/settings` | the v2.2 settings page | account menu | P6 |

The redirects are in `lib/shell/redirects.ts`, read by `next.config.ts`. They are **temporary (307)**, not 308: each
wave-2 workstream builds its page at the v3.9 address and deletes its line, and a permanent redirect would stay in
browsers' caches after it did. `/brand` is the same: P6 builds the v3.9 Brand page there.

### Doors kept for the v2.2 pages

Every section of decision 0103's bar still has a door: Designs is Projects; Templates is on the rail; Catalogue is
Products; Launch, Teamwear, Size charts, Benchmarks and Designer are in ⋯; Crest to kit is in Create; Club is Team (or
⋯); Brand (runs) is Orders › Product runs. The brand switcher is in the workspace avatar menu, Brand Studio is the
brand pill, Credits is in ⊕ and the workspace menu, Settings and Sign out are in the account menu.

## Consequences

- Deleted: `StudioHeader`, `StudioNav`, `GlassMenu`, the old `AccountMenu`, `PageRise`, `lib/shell/sections.ts`,
  `lib/shell/menu-a11y.ts`, and three components only the bar mounted (`BrandCompletionPill`, `BalanceChip`,
  `SignOutButton`). The public, auth, ops and job layouts are unchanged.
- `/brand`'s page is at `/orders/runs`; its links, its `revalidatePath`, its wording test and the two e2e specs that
  opened it follow it. The studio sidebar's "Brand kit" now opens `/brand-studio`, which is what it named.
- e2e: `studio-chrome.spec.ts` is replaced by `shell.spec.ts` (the rail reaches every place and the AI Studio tabs,
  ⋯, Team for a club, the Create menu by keyboard, the account and workspace menus, the redirects, fit at five widths,
  the phone Menu). `chrome.ts`'s `headerFits` becomes `shellFits` (no sideways scroll, no top-bar control past the
  window) and `openStudioSection` becomes `openShellPlace`.
- `/dev/shell` draws the shell with made-up data for the 1440 × 900 comparison with d01 (`?club`, `?new` for the
  other states). It is a public fixture page behind `DEV_UI_ROUTES`, as `/dev/ui` is.
- `lib/shell/**` stays in the 90 % coverage list.

## Owner questions

1. **When is a brand "set up"?** The New tag goes when Brand Studio's details are saved. The alternatives are a
   completion threshold (say 50 %) or every step done.
2. **Upgrade** opens the credits page until P6's plans modal exists. Should it be hidden until then instead?
3. **Help** opens an email to `PRODUCT.contactEmail`. Is there a help centre or chat tool to point it at?
4. **Top bar height:** `09` says 72 px, `10` §4 and the reference image 76 px. This uses 76.

## R-GAP-000

No rulebook entry covers navigation chrome; nothing here carries a rule id.
