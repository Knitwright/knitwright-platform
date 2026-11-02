# 0102: The studio top bar — one account menu, an overflow menu, and room to grow

Status: Proposed; the owner's choice of both ways out of decision 0079 owner question 5, measured offline and in the
browser tests; Benchmarks keeps its sidebar entry as well; owner questions listed
Index: Proposed; the bar's sections go from 625 px to 389 px and the account cluster from three controls to one, Teamwear, Launch and Benchmarks get the entry each workstream was waiting for, Collect deliberately gets none and is reached from the club page instead, the inline-link contrast pattern swept and five pages scanned for the first time, owner questions listed
Index title: The studio top bar: one account menu, an overflow menu, and room to grow
Date: 2026-11-02
Pull request: #134
Plan step: shared chrome. No workstream owns it: it was `plans/platform-v5.md`'s one unowned file, and four pull
requests and three workstreams were waiting on it. Answers decision 0079 owner question 5, decision 0086 owner
question 8 and decision 0091 owner question 5. Builds on decisions 0064 (the phone), 0074 (the studio sidebar),
0079 (the completion pill), 0084 (benchmarks), 0085 (collections), 0086 (teamwear) and 0091 (launch).

## Context

The bar is capped at `PAGE_WIDTH.content` — `max-w-6xl`, so **1110 px of room at every desktop width, and a wider
screen does not widen it**. Seven section pills took **625 px** of that. With the mark, the brand switcher, the
completion pill, the credits chip, the address signed in, Settings and Sign out, the row ran out: what hangs outside
the glass is painted over the **aurora** (`#4a5276`: `#9fb0ff` at an effective 0.44 over `--canvas` `#07080a`), where
`text-muted` is **3.35:1** and fails WCAG AA. axe reported it as nine `color-contrast` failures across
`guided-flow.spec.ts`, `studio-catalogue.spec.ts` and `templates.spec.ts`, every one naming Sign out, because Sign
out was last in the row.

**Each new section costs about 90 px.** Decision 0079's Y6 bought 43 px by making the product name beside the mark
`sr-only` and halving the gaps, and said plainly that this was a patch. Since then Z3 (0084), Z5 (0086), Z8 and L1
(0091) each recorded a section they wanted and each deliberately did not add it, because adding one took width from
another workstream and broke its checks. Four pull requests were blocked on this file and nobody owned it.

### What was actually measured

A previous agent's offline harness was rebuilt for this change: the real `app/globals.css` compiled through
`@tailwindcss/postcss`, the real header markup served with the bundled Geist variable faces, the real aurora behind
it, and axe-core run in headless chromium. It reproduces CI's colours and ratios exactly, and it found three faults
in minutes that would each have cost an 18-minute browser-test round. It is not in the repository: it is a scratch
tool, and the browser tests are the guard that ships.

`main`, measured at the widths the bar is actually used at, with the last control's own 12 px of padding as the
tolerance (positive is outside the glass):

| Width | Bar | Sections | Spill | Last control |
|---|---|---|---|---|
| 390 | 366 | — (one menu) | **+4** | Menu |
| 768 | 728 | 625 | **+374** | Sign out |
| 1024 | 984 | 625 | **+118** | Sign out |
| 1280 | 1112 | 625 | −9 | Sign out |
| 1440 and wider | 1112 | 625 | −9 | Sign out |

Two things that had not been written down before: `main` passes the browser tests only because they run at 1280,
where it sits nine pixels the right side of the line — one more section spends all nine — and **it has been outside
its glass by 374 px at 768 and 118 px at 1024 the whole time**, because the bar switched to its desktop layout at
`md` (768 px) and nothing had ever measured it between 768 and 1280.

## Decision

1. **The account cluster is one menu.** The address signed in, Settings and Sign out are rows of a single `Account`
   menu (`components/shell/AccountMenu.tsx`). They are the same three controls, and `AccountRows` is shared with the
   compact menu, so a phone and a desktop cannot drift.

2. **Sections beyond the first four are in an overflow `More` menu.** `lib/shell/sections.ts` holds the list and
   `PILLS = 4`; `StudioNav` draws the first four as pills and lists the rest. **A section in the menu costs the row
   nothing**, which is the whole point: the list can grow again without anyone measuring anything.

3. **Both menus reuse the bar's own glass panel**, which until now was the phone's alone. `PhoneMenu.tsx` is
   `GlassMenu.tsx` for it — the panel's markup is unchanged, including its `bg-surface-solid/95` and its
   `backdrop-blur-xl`, which were measured open at every width and are clean. No second panel was written, and the
   phone is extending the pattern it already had rather than gaining a new one.

4. **The `Knitwright` wordmark beside the mark is restored**, with exactly the `max-sm:sr-only` it carried before Y6
   took it away: visible from 640 px, for screen readers only on a phone, where the row has never had room for it.

5. **The compact layout runs to 1024 px rather than 768.** This is the fix for the band nothing had measured. Below
   `lg` the bar is the one `Menu` it has always been on a phone, holding every section and the account rows.

6. **The sections that were waiting are wired in**:
   - **Teamwear → `/teamwear`** (Z5, decision 0086 owner question 8). It was reachable only by typing the address,
     which left the product's shop window with no door.
   - **Launch → `/launch`** (L1, decision 0091 owner question 5), beside Designs and Templates, as that record asks.
   - **Benchmarks → `/studio/benchmarks`** (Z3, decision 0084 item 11). It was the first to drop if it did not fit
     comfortably, and in the menu it fits for nothing: it costs no width at all. Z3's studio-sidebar entry **stays**,
     because it is the entry that carries the "Compare products" hint; the difference is that the section is now
     reachable from every signed-in page rather than only from the studio home. Owner question 2 asks whether to
     keep both.
   - **No `Collect` section, but the club page now has the link** (Z7). Z7 recommends reaching `/collect` from the
     club page's "Seasons and rosters" section rather than from the bar, which costs the bar nothing, and that is
     what this does: `PageSection`'s `description` takes a `ReactNode`, so it is the one-line change Z7 asked for.
     The route did not exist when this branch opened — Z7 merged while it was in flight — and the link was held back
     rather than written as a dead one. `club.spec.ts` asserts the link's address, so it cannot rot.

7. **The menus are menus, not hover panels.** `GlassMenu` is a disclosure: it opens on a click or a press, carries
   `aria-expanded` and `aria-controls`, closes on Escape, on a click outside it and on a new address, and gives focus
   back to its own button. While it is open Tab goes round the button and the panel's controls and leaves neither
   (`lib/workspace/focus-trap.ts`'s `trapTarget`, as the create-new modal uses). Nothing depends on hover. Every
   target is at least 40 px. `prefers-reduced-motion` is answered by the global rule, which the panel's entrance
   obeys.

   It is deliberately **not** a `role="menu"`: that role promises arrow-key movement between `menuitem` children, and
   these panels hold ordinary links and a sign-out form. The panel takes `role="group"` so it can carry the name its
   button points at; a plain `div` takes no accessible name, and axe counts `aria-label` on one as a serious fault.

8. **The current section is named even when it is inside the menu.** Each listed link carries `aria-current="page"`
   as the pills do, and the `More` button adds ", current section: Teamwear" to its own name and takes the pills'
   current styling, so neither a screen reader nor an eye has to open the menu to find out where it is.

9. **`sectionFor` resolves the current section by longest owned prefix**, not by a hand-written matcher. The matcher
   it replaced read `(path === "/studio" || path.startsWith("/studio/")) && !path.startsWith("/studio/charts")`, and
   adding Benchmarks under `/studio` would have added a second negation to it. Now `/studio/charts` and
   `/studio/benchmarks` win their own addresses because their prefixes are longer, and `/brand-studio` belongs to no
   section because a name that merely begins with `/brand` is not inside it.

10. **The inline-link contrast fault is swept.** `text-cobalt-soft` on an inline link fails twice, measured over the
    aurora: axe's `link-in-text-block` reads it at **1.53 to 1.64:1** against the muted words around it where 3:1 is
    wanted, and `color-contrast` reads the link itself at **3.92:1** at 15 px and 13 px where 4.5:1 is. The second
    figure is **`.soft-link`'s own doing**: its `opacity: 0.9` takes `--cobalt-soft` a tenth down, and the undimmed
    colour passes. Brand Studio's two instances had been fixed by underlining them and using `text-ink`; the same is
    now done for `app/(app)/brand/page.tsx`, `app/(app)/club/page.tsx`, the three make pages, the launch home's
    closing line and the share page's privacy notice. One more was found: a link with **no colour of its own** inside
    a paragraph that also holds muted text is 1.23:1 against its own paragraph, so `ProductsPanel`'s design name is
    underlined too.

    A bold cobalt link measures clean — axe 4.14 counts a font-weight difference as distinguishing — so
    `AuthCard`'s `TextLink`, `KitStylesLink` and the kit-style gallery's back link are left alone. Ten links of
    their own (not inside a block of text, so `link-in-text-block` does not apply) keep `soft-link text-cobalt-soft`
    and are listed in owner question 3 with their figure, because the single fix for all of them is a change to
    `.soft-link` across the whole product and that is not this change's to make.

11. **The guard is extended, not replaced.** `headerFits` and the axe helper were written in
    `e2e/brand-studio.spec.ts` and move to `e2e/chrome.ts`, because five specs want them at once and `e2e/support.ts`
    is already the longest file in that folder. `headerFits`
    asserts exactly what it did — the last control of the row keeps its words on the glass, tolerance the control's
    own 12 px of padding — but finds that control at whatever width it is measured at, since Sign out is no longer
    last and no longer in the row. `headerFitsAtEveryWidth` runs it at **390, 768, 1024, 1280 and 1440**.

## Consequences

The bar after this change, same harness, same tolerance:

| Width | Bar | Sections | Spill | Last control |
|---|---|---|---|---|
| 390 | 366 | — (one menu) | −9 | Menu |
| 768 | 728 | — (one menu) | −9 | Menu |
| 1024 | 984 | **389** | −6 | Account |
| 1280 | 1112 | **389** | −9 | Account |
| 1440 and wider | 1112 | **389** | −9 | Account |

- **The sections went from 625 px to 389 px** and the account cluster from three controls to one, and the row is
  inside its glass at every width for the first time. The 374 px, 118 px and 4 px overflows are gone, and so is the
  contrast fault they caused. The 4 px is a phone: `main` is outside its glass at 390 px too, by the width of
  roughly one letter, and that is the width Settings paid for by standing in the row at every size.
- **Ten sections now, where seven did not fit.** Three of them were wired in by this change and the next one costs
  the row nothing, so no workstream has to take width from another again.
- **1024 px is the tightest width**, with about six pixels of slack, and it is the brand switcher that pays for it:
  it is the row's only truncating control, so between 1024 and about 1110 it is squeezed towards its 40 px minimum
  and shows an ellipsis. Its `sr-only` label still reads the brand's name in full. `main` does this too **and**
  overflows, so this is strictly better, but it is not good, and owner question 1 asks about it. A six-figure credit
  balance at 1024 puts the row 7 px past the glass edge, inside the 12 px tolerance, with its words still on glass.
- **The mark keeps `min-w-10`.** Giving the name back cost the mark its `justify-center` and its `min-w-10` in the
  first draft of this change, and on a phone the name is `sr-only`, so the link measured 24 by 40 and
  `mobile.spec.ts` failed it on every signed-in page at once. It is back, and it costs the row nothing: the figures
  above are the same with it. `e2e/studio-chrome.spec.ts` now measures the mark itself at 390 px as well, because
  `mobile.spec.ts` is not on the pull-request gate and this is the chrome's own rule to keep.
- **Two specs reached `/brand` and `/club` by clicking a section pill** and now go through the overflow menu, by
  `openStudioSection`, which opens the menu only when the section is not a pill. `accounts.spec.ts` opens the account
  menu for the address and for Sign out.
- **`/collect`'s own two inline links were swept with the rest.** It arrived after the sweep, carrying both shapes:
  a cobalt link inside muted prose, and a design name with no style of its own inside a heading that also holds muted
  words. It has no axe scan of its own — `roster-signup.spec.ts` and `committee.spec.ts` each scan the page the
  player or the guest sees, not `/collect` — and adding one is Z7's to do.
- **Five pages are scanned by axe for the first time**: `/brand`, `/club` and the three make pages. That is what
  stops the inline-link fault coming back, and it is why those specs are the ones that matter most on this branch.
- `e2e/studio-chrome.spec.ts` is new and owns the chrome's own cover: which sections are pills and which are listed,
  that the three waiting addresses have a door, that the overflow button names the current section, that the account
  menu is a real menu, and that a phone still has exactly one menu holding everything.
- `lib/shell/**` is a new directory and is in `vitest.config.mts`'s 90 % list, one name in its sorted place.
- **What this does not change:** the bar is still capped at `PAGE_WIDTH.content`. The third way out of decision 0079
  owner question 5 — letting the bar be wider than the page column it lines up with — was not taken, because it
  changes how every signed-in page is framed and the owner chose the other two.

## Dependencies

No new dependency. Everything here is already in the lock file: React, Next.js, Tailwind, and `@axe-core/playwright`
in the browser tests. The offline harness used `@tailwindcss/postcss`, `playwright` and `axe-core`, all three already
present, and nothing was added to the repository for it.

## Owner questions

1. **Between 1024 px and about 1110 px, which gives way: the brand's name or the four section pills?** Four pills,
   the overflow button, the mark and the name, the completion pill, the credits chip and the account menu leave the
   brand switcher at its 40 px minimum, so it shows an ellipsis and its name is readable only to a screen reader.
   The alternatives are to use the compact menu up to 1280 rather than 1024 (a readable brand name, no visible
   section pills on a 1100 px window), or to show three pills rather than four below 1280. Four pills is what this
   change implements, because that is what the decision said.
2. **Should Benchmarks keep both entries?** It now has one in the studio sidebar, with its "Compare products" hint,
   and one in the bar's overflow menu, which reaches it from every signed-in page rather than only from the studio
   home. Decision 0084 item 11 said the sidebar was the one entry because the bar had no width; the bar now has the
   width. Keeping both is the state this change leaves; dropping the sidebar one is a one-line change in
   `lib/home/sidebar.ts`, which is Y1's file.
3. **`.soft-link`'s `opacity: 0.9` is a contrast change, not just a finish.** It takes `--cobalt-soft` from AA to
   **3.92:1** over the brightest part of the aurora, and every one of the ten remaining `soft-link text-cobalt-soft`
   links carries that figure: the two launch error pages, the launch home's table, the launch history's two links,
   the collections table, `BrandTab`'s two "Manage brand" links, `StyleCard`'s and the factory file's "Back to the
   design". None of them is inside a block of text, so none fails `link-in-text-block`, and none of their pages is
   scanned today — but each will fail a `color-contrast` scan wherever the aurora behind it is bright. The one fix for all of them is one line of
   `globals.css`: stop dimming a link by a tenth at rest and settle something other than its colour on hover. That
   changes the hover of about forty links across the product, so it is the owner's call, not this change's.
4. **Should the account menu show who is signed in without being opened?** The address was in the row and is now the
   menu's first row. The button says "Account" and nothing more, so at a glance a desktop no longer shows which
   account it is. Putting the address in the button's name costs nothing structurally but makes the button as wide as
   the address, which is the width this change spent its effort reclaiming.

## R-GAP-000

No rulebook entry covers the chrome, so none of these numbers carries a rule id. The gaps are: what the smallest
width the studio supports is (390 px is asserted, nothing says it), how many sections the bar should ever show as
pills (four, because the owner said four), and whether the bar may be wider than the page column it lines up with.
