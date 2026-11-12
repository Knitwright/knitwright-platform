# 10 · Design system

This file turns the prototype into rules a developer can build from. It defines **tokens** (colour, type, spacing, radius, shadow, motion) and **components**, with every state, plus the page-level states the prototype doesn't show.

**How the sources fit together:**
- **The prototype** (`prototype/index.html`) shows layout.
- **The screen images** (`references/prototype-screens/`) show each screen at 1440 × 900.
- **This file** decides the exact values.

**Where they disagree, this file wins.** The prototype was hand-built and has one-off values (a 19 px font, a 9 px radius). Snap those to the nearest token.

**Build it as a component library first** (Storybook or similar), with every state below. Then build screens only from those components.

---

## 1. Principles

1. **Kittl's calm, white, rounded interface.** It feels like a creative tool, not an ERP. Lots of white, soft grey sections, big rounded corners, one dark primary button per area.
2. **Manufacturing truth is always visible but never noisy.** Locks (🔒), checks (✓ / ⚠) and "Why?" links sit next to the thing they describe, in small text. They never appear as banners, unless an order is blocked.
3. **One primary action per surface.** It is navy, or gold only for upgrades and buying credits. Everything else is a white secondary button.
4. **Real garments, real sizes.** Measurements are always shown in the user's unit (mm / cm / in) with a tolerance. Never round a factory value for display.

## 2. Colour

### Brand and neutrals

| Token | Hex | Use |
|---|---|---|
| `navy` | `#0B1F4B` | Primary buttons, selected tabs (pill style), logo tile, headings on dark |
| `navy-2` | `#142C63` | Navy hover |
| `navy-3` | `#06132F` | Navy pressed |
| `electric` | `#2F6BFF` | Selection outlines, board handles, links, focus ring, sliders, connectors |
| `electric-soft` | `#EAF0FF` | Selected row / selected card background |
| `gold` | `#F2B705` | Premium (♛), upgrade and credit purchase buttons, highlighted column (sample size) |
| `gold-soft` | `#FFF4CC` | Highlighted column fill, "new" badges, beta tag |
| `bg` | `#FFFFFF` | Page and panel background |
| `soft` | `#F3F4F6` | Section cards in panels, segmented-control track, chip hover, skeletons |
| `soft-2` | `#ECEEF2` | Canvas background, hover on `soft` |
| `border` | `#E5E7EB` | All 1 px borders and dividers |
| `dot` | `#D5D9E0` | Canvas dot grid |
| `text` | `#111318` | Primary text |
| `text-2` | `#374151` | Menu items, secondary body text |
| `muted` | `#6B7280` | Labels, captions, helper text |
| `muted-2` | `#9CA3AF` | Placeholders, disabled text, column letters |

### Status

| Token | Text | Fill | Use |
|---|---|---|---|
| `ok` | `#067647` | `#E7F8EF` | Approved, passed, in tolerance, published |
| `warn` | `#B54708` | `#FEF0C7` | Sampling, waiting, close to limit |
| `bad` | `#D92D20` | `#FEE4E2` | Failed check, out of tolerance, error toast icon |
| `info` | `#2F6BFF` | `#EAF0FF` | In production, in batch, informational notes |

### Tech pack marks

- **Measurement points:** `bad` red circles with white letters (A–H), joined by red 1.5 px lines.
- **Callouts:** `electric` blue circles with white numbers.
- **Never swap these.** Factories read red as "measure here".

**Accessibility:** body text on white must be at least 4.5 : 1. `muted` on white is 4.8 : 1, so it's fine. `muted-2` is only for placeholders and disabled text, never for information.

**Dark mode:** none in v1 (Kittl has none). The canvas, Garment Studio stage and presentation mode use dark backgrounds as content, not as a theme.

## 3. Typography

**Font: Inter** (variable), with `font-feature-settings: "cv11", "ss01"` for straight-legged digits in tables. **Numbers in tables use `tabular-nums`.**

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 48 / 56, −0.03em | 800 | AI Studio and dashboard hero titles |
| `h1` | 30 / 38, −0.02em | 700 | Page titles (`.pagehead h2`) |
| `h2` | 24 / 32, −0.01em | 700 | Modal titles, section titles on pages |
| `h3` | 20 / 28 | 700 | Card group titles, panel titles (flyout header) |
| `title` | 17 / 24 | 600 | Card titles, inspector section headers |
| `body-lg` | 15 / 22 | 500 | Menu items, inputs, buttons (md), inspector rows |
| `body` | 14 / 20 | 400 / 500 | Default text, table cells |
| `small` | 13 / 18 | 500 | Chips, captions, panel text, small buttons |
| `caption` | 12 / 16 | 500 / 600 | Pills, badges, table headers, helper text |
| `micro` | 11 / 14 | 600, uppercase, +0.04em | Overlines ("KNITWRIGHT LIBRARY"), sheet column letters |

- **Weights:** 400 for body, 500 for UI text, 600 for buttons and labels, 700 for headings, 800–900 only for display titles and kit lettering previews.
- **Kit fonts** (Anton, Bebas Neue, Graduate and so on) appear only inside designs and font previews, never in the UI.

## 4. Spacing, sizing and layout

**Spacing scale (4 px base):** 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64. Don't use other values.

### App frame at 1440 × 900 (the reference size)

| Area | Size |
|---|---|
| Dashboard left nav | 96 px wide; icon 22 px; label `caption` below the icon |
| Dashboard top bar | 76 px high; page padding 40 px left, 36 px right |
| Dashboard content | Padding 0 40 px 60 px; grids use 16–20 px gaps |
| Editor top | No full-width top bar (as in Kittl): the logo and ≡ menu sit at the top of the rail; avatar, Share, Export and Order sit at the top of the inspector |
| Editor rail | 60 px wide with menu labels off, 76 px with labels on |
| Editor flyout panel | 320 px wide; padding 16 px 14 px |
| Editor inspector (right) | 310 px wide |
| Garment Studio | Top bar 64 px · library column 236 px · library panel 380 px · stage flexible · right panel 360 px (in tech pack mode: library 236 px · stage flexible · tech pack 720 px) |
| Floating task bar | 50 px high, 14 px radius, sits 16 px above the selection |
| Bottom dock | 50 px high, centred, 16 px from the bottom |
| Prompt bar | Max width 720 px, 18 px radius, centred above the dock |

### Breakpoints

- **Editor and Garment Studio:** minimum 1280 px wide. Below that, show a "Use a larger screen" notice with Open on desktop / Email me the link.
- **Dashboard pages:** must work down to 1024 px. Grids drop a column; the left nav stays.
- **Mobile (375 px and up)** is required for:
  - the team store;
  - checkout;
  - roster sign-up;
  - order tracking;
  - the committee approval link.

  These are the parent and club-member journeys; 01 requires "checks out in under 2 minutes on a phone". On mobile they use a single column, a bottom sticky primary button, and inputs at least 44 px high.

## 5. Radius, borders and elevation

| Token | Value | Use |
|---|---|---|
| `r-xs` | 4 px | Colour swatches, table chips |
| `r-sm` | 8 px | Small buttons, thumbnails, inputs inside tables |
| `r-md` | 10 px | Buttons, inputs, menu items, template cards |
| `r-lg` | 12 px | Search fields, cards on pages, toasts |
| `r-xl` | 14 px | Panel section cards (`soft`), task bar, dock, order cards |
| `r-2xl` | 16 px | Popovers, menus |
| `r-3xl` | 22 px | Modals |
| `r-full` | 999 px | Chips, pills, avatars, toggles |

**Borders** are always 1 px `border`. Selection is a 2 px `electric` outline, offset 0, plus 8 × 8 px white handles with a 1.5 px electric border.

| Elevation | Shadow | Use |
|---|---|---|
| `e0` | none | Flat cards on pages (border only) |
| `e1` | `0 1px 3px rgba(16,24,40,.08)` | Thumbnails, boards on canvas |
| `e2` | `0 4px 16px rgba(16,24,40,.10), 0 1px 3px rgba(16,24,40,.08)` | Task bar, dock, prompt bar, hover-lifted cards |
| `e3` | `0 16px 40px rgba(16,24,40,.22)` | Popovers, menus, colour picker, font picker |
| `e4` | `0 24px 60px rgba(16,24,40,.30)` | Modals (with a `rgba(17,19,24,.45)` backdrop) |

## 6. Iconography

- **Lucide** icons: 20 px in buttons and menus, 22 px in the left nav and rail, 16 px inline in text. Stroke 1.75, colour `currentColor`.
- **Custom marks:**
  - ♛ for premium (gold, 12 px, top-right of the thing it gates);
  - the **KW credit coin** (gold circle, navy "KW", 18 px);
  - 🔒 (Lucide `lock`, 14 px, `muted`) for values only Knitwright QC can change.
- **The logo tile:** navy square, 12 px radius, gold "KW". Replace it with the final logo SVG when supplied.

## 7. Motion

| Token | Duration and easing | Use |
|---|---|---|
| `fast` | 120 ms ease-out | Hover, press, toggles |
| `base` | 180 ms cubic-bezier(.2,.8,.2,1) | Menus and popovers (fade + 4 px rise), tabs |
| `slow` | 260 ms cubic-bezier(.2,.8,.2,1) | Modals (fade + 0.98 → 1 scale), flyout panels (slide 12 px) |
| `canvas` | 200 ms | Zoom to fit, board add |

- Respect `prefers-reduced-motion`: turn movement off and keep the fades.
- 3D garment rotation is user-driven only; never auto-spin, except on the product page turntable (paused on hover).

## 8. Components and their states

Every interactive component needs all of these states:

| State | Treatment |
|---|---|
| default | As specified below |
| hover | One step darker, or a `soft` background |
| pressed | Two steps darker; no scale transform |
| focus-visible | 2 px `electric` ring, 2 px offset (keyboard only) |
| disabled | 40% opacity, `not-allowed` cursor, a tooltip saying why |
| loading | Spinner replaces the icon; label stays; width doesn't change |

### Buttons

| Variant | Default | Hover | Notes |
|---|---|---|---|
| Primary | `navy` fill, white text | `navy-2` | One per surface |
| Secondary | White, 1 px `border`, `text` | `soft` | Default button |
| Premium | `gold` fill, `navy` text | `#E0A800` | Upgrade, buy credits, ♛ actions |
| Ghost | Transparent, `text-2` | `soft` | Toolbars, task bar, dock |
| Danger | White, `bad` text | `#FEE4E2` | Delete; always confirm |
| Link | `electric` text, no padding | Underline | Inline "Why?", "View roster" |

- **Sizes:**
  - lg: 44 px high, padding 18 px, `r-md`, `body-lg`;
  - md: 40 px high, padding 16 px, `r-md`, 14/600 (the default);
  - sm: 32 px high, padding 12 px, `r-sm`, 13/600;
  - xs: 28 px high, padding 10 px, 7 px radius, 12/600.
- **Icon buttons** are square at the same heights. **Icon + label** spacing is 8 px.

### Inputs

- **Text input / select:** 44 px high, `r-md`, 1 px `border`, padding 0 12 px, `body-lg`.
  - Hover: border `#D0D5DD`. Focus: border `electric` plus a 3 px `electric-soft` ring.
  - Error: border `bad`, plus a 12 px helper text in `bad` below.
  - Disabled: `soft` fill.
- **Search field:** 46 px high, `r-lg`, search icon on the right, placeholder `muted-2`.
- **Number with unit** (measurements, mm positions): right-aligned tabular digits, unit suffix in `muted`, arrow keys step by 1 (Shift steps by 10).
- **Segmented control:** `soft` track, 4 px padding, `r-md`. The selected segment is white with `e1`. Use it for 2D / 3D / Tech pack, Monthly / Yearly, and List / Board.
- **Toggle:** 36 × 20 px, `r-full`. Off: `#D0D5DD`; on: `navy`.
- **Checkbox / radio:** 18 px, navy when checked.

### Tabs

- **Underline tabs** (panels, pages): 14/500 `muted`; the selected tab is `text` with a 2 px `navy` underline; 18–24 px gaps.
- **Pill tabs** (tech pack, Projects sub-tabs): 32 px high, `r-md`; the selected tab is a `navy` fill with white text.

### Chips, pills and badges

- **Filter chip:** 32 px, `r-full`, 1 px border, 13/500. Selected: `navy` fill, white text. A count chip shows "Size · 3".
- **Status pill:** 24 px, `r-full`, 12/600, status colours from §2.
- **Tag:** 20 px, `r-xs`, 11/700 uppercase, for example `KIT-SAFE` (`ok` colours), `BETA` (`gold-soft` / `navy`) and `CLASS B` (`soft`).

### Menus and popovers

- **Menu:** white, `r-2xl`, `e3`, padding 8 px.
  - **Items:** 40 px, `r-md`, 15/500 `text-2`, icon 20 px; hover `soft`.
  - **Separators:** 1 px `border` with 6 px margins. **Shortcuts:** right-aligned `muted` 13 px. **Submenus:** a `chevron-right` at the far right.
  - **Compact menus** (zoom, task-bar "n more") use 36 px items.
- **Popover** (Export, Share, Order, Version history): white, `r-2xl`, `e3`, padding 18 px, fixed width (Export 360 px, Share 400 px, Version history 360 px), anchored 8 px below its trigger. Close with Esc, a click outside, or the trigger again.
- **Tooltip:** `text` fill, white 12/500, `r-sm`, padding 6 × 8 px, after a 400 ms delay.

### Modals

- **Widths:** small 480 px, medium 720 px, large 960 px, sheet preview 1320 px. Max height 92 vh.
- Radius `r-3xl`, shadow `e4`. Header: `h2` title with an × at the top-right (40 px hit area).
- Footer buttons are right-aligned: secondary, then primary.
- Esc closes the modal unless it has unsaved input; then ask "Discard changes?".
- Focus is trapped inside. On open, focus the first input or the primary button.

### Toasts

- Dark `text` fill, white 15/500, `r-lg`, 12 × 18 px padding, top-centre, 28 px from the top. Auto-hides after 4 s; stays while hovered.
- Variants: success (✓ `ok`), error (⚠ `bad` icon, with "Retry" when there is one), info.
- An error that cost nothing says so: "Generation failed, no credits used".

### Cards

| Card | Spec |
|---|---|
| Template / mockup thumbnail | 116 × 136 px in panels; `r-md`; 1 px border; hover lifts to `e2` and shows "Use" plus ♡ |
| Project card (Kittl Projects) | 4:3 thumbnail on `soft`, `r-lg`; below it, title 15/600 + "Edited 2 h ago" `muted`; artboard count badge top-left; ⋯ menu on hover |
| Product card (catalogue) | 1:1 image on `soft`, `r-lg`; name 15/600, "From £22" + Studio Pro price in `ok`; decoration chips |
| Order / info card | White, 1 px border, `r-xl`, padding 20 px, 18 px gap; `title` header with a right-aligned meta line |
| Panel section | `soft` fill, `r-xl`, padding 12 px; header 13/600 with a "Show All" link |

### Tables

- Header row: 12/600 `muted`, 40 px high, no fill.
- Rows: 44 px, `body`, 1 px `border` dividers, hover `soft`.
- Numbers are right-aligned and tabular.
- **Highlighted column** (sample size): `gold-soft` fill, 600 weight.
- **Locked cells:** a 🔒 icon, `muted` text, not editable, with a tooltip saying who can change them.
- **Editable cells:** show a 1 px border on hover; on click they become inputs.

### Canvas (editor)

- **Canvas:** `soft-2` background with a `dot` grid every 24 px. Zoom from 10% to 400%.
- **Boards:** white, `e1`, with a 13/600 name label above (`muted`, `text` when selected).
- **Selected board:** a 2 px `electric` outline, 6 handles, and the task bar above it.
- **Connectors:** a 1.5 px `electric` line with a 10 px dot at each end. The right-edge "+" dot opens the Add… menu.
- **Locked garment areas** (seams, safe zone): a dashed `electric` line at 1.2 px. Out-of-zone artwork gets a `bad` outline and a check in the inspector.

### Inspector (right panel)

- Sections have a 17/600 header and a collapse chevron, 16 px padding and 1 px dividers.
- Rows are 40 px with the label on the left (`muted`) and the control on the right.
- **Colour rows:** a 24 px swatch plus the hex value. Clicking opens the colour picker, which has Color and Brand tabs.
- **"Why?" links** sit at the end of the row they explain.

## 9. Page and data states (build all of them)

| State | Rule |
|---|---|
| **Loading** | Skeletons matching the final layout (`soft` blocks, `r-md`, a 1.2 s shimmer). Show nothing for the first 300 ms. Never use a full-page spinner after the first load. |
| **Empty** | An illustration or icon in a 64 px `soft` circle, an `h3` title, one line of help, and one primary action ("Create your first kit"). See the empty Orders and Brand screens. |
| **Error (page)** | Same layout as Empty with a `bad` icon, a plain explanation, Retry, and "Contact support" with the request ID. |
| **Error (field)** | Inline, under the field. Never only in a toast. |
| **No permission** | "Ask the owner for access" with a Request access button. Show the owner's name. |
| **Offline / saving** | The editor top bar shows "Saving…" → "Saved" → "Offline, changes kept on this device". |
| **Premium-gated** | The control stays visible with ♛. Clicking opens the plan modal on the relevant plan; never hide the feature. |
| **Factory-locked** | The value stays visible with 🔒 and a tooltip ("Set by Knitwright QC after the golden sample"). |
| **AI generating** | The board shows a progress shimmer and a timer ("~20 s"), and credits are shown before running. Cancel is always possible. |

## 10. Content and voice

- **Sentence case** everywhere ("Order samples", not "Order Samples"). British English: colour, centre, catalogue.
- **Buttons say what happens:** "Order 25 shirts · £625", not "Submit".
- **Prices** always show their currency and whether VAT is included. Dates use "4 Dec"; times use 24 h plus the time zone for factory cut-offs ("Mon 12:00 PKT").
- **Never promise what the factory hasn't confirmed:** "Usually 18–21 days" until the slot is booked, then the date.

## 11. Definition of done for a UI ticket

1. Built only from library components and tokens (no raw hex, px or shadows in screen code).
2. Matches its image in `references/prototype-screens/` at 1440 × 900. Attach a side-by-side screenshot to the PR.
3. All states from §8 and §9 exist and are reachable in Storybook or a fixture route.
4. Works by keyboard (tab order, Esc closes, focus visible) and passes axe with no serious issues.
5. Mobile journeys (§4) checked at 375 px.
6. No layout shift when data loads; long names truncate with an ellipsis and a tooltip.
