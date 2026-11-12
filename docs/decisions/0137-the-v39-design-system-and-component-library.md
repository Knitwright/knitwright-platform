# 0137: The v3.9 design system, its component library, and the v2.2 names on a light theme

Status: Accepted (plan v6, workstream U1)
Index: Accepted; light tokens from `10`, Inter, lucide-react, the component library in components/ui, /dev/ui, and one compatibility block for the v2.2 names
Index title: The v3.9 design system and component library
Date: 2026-11-12
Plan step: v6 wave 1, U1. Follows decision 0131 (build pack v3.9 replaces the v2.2 UI).

## Context

Build pack v3.9 replaces the v2.2 dark glass theme (Geist, cobalt, the aurora) with Kittl's calm, white, rounded
interface. `docs/spec/10-design-system.md` gives exact values for colour, type, spacing, radius, elevation and motion,
and lists every component with its states. Waves 2 to 4 rebuild the screens. Until they do, every v2.2 screen must
stay legible on the light theme.

## Decision

1. **Tokens** live in `apps/web/app/globals.css` as a Tailwind v4 `@theme`: the §2 colours (`bg-navy`,
   `text-text-2`, `bg-ok-soft` and so on), the §3 type scale (`text-h1`, `text-body-lg`, `eyebrow` for the micro
   overline), the §5 radii (Tailwind's `rounded-xs` to `rounded-3xl` are given §5's values), `shadow-e1` to
   `shadow-e4`, and the §7 motion (`duration-fast|base|slow|canvas`, `ease-standard`). Light theme only:
   `color-scheme: light`, and no dark mode.
2. **Font:** Inter through `next/font/google` (self-hosted at build), with `"cv11", "ss01"`. Geist Mono stays for the
   `font-mono` labels the v2.2 screens still use.
3. **One deviation from `10`, for accessibility:** `electric` (#2F6BFF) is 4.499:1 on white, a hair under WCAG AA.
   Outlines, fills and the focus ring keep the exact `electric`; blue *text* uses `link` (#2558E8, 5.7:1 on white,
   5.1:1 on `electric-soft`). `10` itself requires 4.5:1 for body text, so this keeps both rules. For the same reason
   `bad` text on its own `bad-soft` fill (4.0:1) uses `bad-strong` (#B42318, 5.5:1) in pills and tags; `bad` stays
   for icons, borders, the measurement marks and text on white. `10`'s `muted` (#6B7280) is 4.4:1 on its own `soft`
   and 4.1:1 on `soft-2`, so muted captions on grey sections failed AA in the browser tests; `muted` is #5F6672
   (5.8:1 on white, 4.9:1 on `soft-2`, 5.1:1 on `electric-soft`). `/dev/ui` passes axe with no serious finding
   (`e2e/dev-ui.spec.ts`).
4. **The compatibility block** (one marked section at the end of `globals.css`) gives every v2.2 name a light value:
   `canvas`, `surface`, `surface-solid` become white; `shell` soft; `ink` text; `ink-2` text-2; `muted` and `faint`
   muted; `hairline` border; `tile` #F7F8FA (a little lighter than `soft`); `tile-2`
   soft-2; `chalk` text; `cobalt` navy; `cobalt-soft` link; `cobalt-wash` electric-soft; the `-wash` fills the §2
   status fills; the thread gradient link-to-navy. `glass` is a white card with a 1 px border; `chip-cta` a navy
   primary; `chip-btn` a white secondary; `lift` a shadow lift. In v2.2 classes "white" meant "the colour that stands
   out from the surface", so `--color-white` is ink on light surfaces (`text-white` reads dark, `bg-white/12` is a grey
   tint) and white again inside the dark fills the old screens still use (`bg-cobalt`, `bg-ink`, `bg-black/35` and
   darker). New code uses the fixed `text-on-dark`. The `Aurora` component is deleted. Each piece of the block goes
   when the last screen using it is rebuilt.
5. **The component library** is `apps/web/components/ui/`: Button (primary, secondary, premium, ghost, danger, link;
   lg/md/sm/xs; loading; disabled with a tooltip saying why, as `aria-disabled` so it keeps focus), TextInput,
   SearchInput, NumberInput (unit, ↑↓ by 1, Shift by 10), Select, Segmented, Toggle, Checkbox, Radio, Tabs
   (underline, pill), FilterChip, StatusPill, Tag, Badge, Menu, Popover, Modal (480/720/960/1320, focus trap, Esc,
   "Discard changes?"), Toast with `ToastProvider` in the root layout, Tooltip, Card variants, Table (highlighted
   column, locked cells), Skeleton, the §9 states (EmptyState, ErrorState with Retry and request ID, NoPermission,
   PremiumGate ♛), the KW coin, ♛, 🔒 and the logo tile. Existing exports keep their props: `Button`'s `pending`,
   `arrow` and `quiet`, `buttonClasses(variant, arrow, className)`, `LinkButton`, `Field`, `SelectField`,
   `CheckboxField`, `Notice`, `Skeleton*`.
6. **`/dev/ui`** shows every component in every state. It reads no data and needs no session (listed in
   `lib/server/public-pages.ts`). A production build answers 404 unless `DEV_UI_ROUTES=on` (in `.env.example`).

## Dependencies

- `lucide-react` 1.72.0, ISC licence (a permissive licence equivalent to MIT), for the Lucide icons `10` §6 names.
- Inter is loaded through `next/font/google`, part of Next.js (MIT); the font is under the SIL Open Font Licence and is
  self-hosted at build time.

## Consequences

- Waves 2 to 4 build screens only from these components and tokens (`10` §11).
- `10` §7 asks reduced motion to keep the fades; the existing global rule turns every animation off, which
  `tests/architecture/motion.test.ts` holds. Kept as is: no movement, and no fade either.
- Tailwind's default radii changed to §5, so v2.2 screens' `rounded-lg` and `rounded-md` are slightly rounder.
