# 0144: Team, Brand and Settings take their v3.9 addresses, and one plans modal of placeholder rows answers every Upgrade

Status: Accepted (plan v6 P6, 2026-11-13)
Index: Accepted; /club and /collect become /team (Roster · Approvals · Seasons, with the roster-retention opt-in), /brand-studio becomes /brand (empty and filled Kittl layouts), /settings gets its cards and a stored garment unit, and Upgrade and every ♛ gate open Choose Your Plan from placeholder plan rows
Index title: Team, Brand, Settings and the plans modal
Date: 2026-11-13
Plan step: v6 wave 2, workstream P6. Migration `20261222060000_person_preferences.sql`.

## Context

Screens 17 (Team), 18 (Brand), 19 (Settings) and 29 (Upgrade to export tech packs) of `docs/spec/09-screen-map.md`,
08 §4.6 and the v3.4 "Choose Your Plan" block. Decision 0138 left `/team` aliased to `/club`, `/brand` to
`/brand-studio`, and the top bar's Upgrade on the credits page until this workstream. D5 (decision 0136) built the
club's opt-in to keep old rosters, `set_roster_retention`, with no screen.

## Decisions

### 1. Pages that moved, and where every part of them went

| Old address | New address | Redirect |
|---|---|---|
| `/club` | `/team` | 308 |
| `/collect` | `/team?tab=approvals` | 308 |
| `/brand-studio` (with its `?tab=`) | `/brand` (the query is carried) | 308 |
| `/brand-studio/import` | `/brand/import` | 308 |

The `/team` and `/brand` aliases of decision 0138 are deleted. The moves are `permanent` entries in
`lib/shell/redirects.ts`'s list beside the temporary aliases.

The club page's sections went to the place the v3.9 screens put them; every action and route is unchanged:

- **Seasons and rosters**, the **order history** with two-click reorder → Team › Seasons.
- **Collect**'s committee links → Team › Approvals; its player sign-up link → Team's "Player sign-up link"
  (`/team?view=signup`, the newest season).
- The roster editor (Add player, Import CSV) → `/team?view=edit`, under the Roster table.
- **Club kit** and "use the kit on a design" → Brand › Sportswear ("kit colours mapped", 08 §4.6). The Colours tab
  still reads the kit through and never writes it (decision 0079); its note now names the Sportswear tab.
- **Members and roles**, and "You have been invited" → Settings › Members. ⊕'s Invite people opens it.

### 2. Team (screen 17, d18)

Tabs Roster · Approvals · Seasons as links. Roster is the newest season's players in the U1 table (name on shirt in
capitals, number, size, status pill), a repeated number flagged "Duplicate number" and kept (F-T4), and the people the
sign-up still waits on as "Waiting" with a reminder link to the sign-up view. Under it, a committee card per design
with a live link: votes per version, comments, days until the link expires, and approvals against everyone who
answered (`lib/team/view.ts`). Seasons holds D5's opt-in as a toggle that calls `set_roster_retention` through
`setRosterRetentionAction`; only an owner or an admin may change it, as the function itself checks.

### 3. Brand (screen 18, d16, d17)

A brand with nothing saved sees the empty state: the heading, a URL field whose **Import** opens the import screen
with the address filled in (a plain GET form, so it works without scripts; nothing runs until "Read my site"), OR,
**+ Create new** and **Start from my crest**, and the video slot (our own navy and gold tile; no video ships). Once
anything is saved it is the Kittl layout: the side card (initials tile, website, name, about, Brand completion with
its bar), the gold visual-style banner (Try in AI workflows once the three texts are written, else Import from a
link), and the tabs. Overview's cards are `lib/brand-studio/overview-cards.ts`. The stale "import it in a later
release" lead is gone: the import shipped in decision 0108.

### 4. Settings (screen 19, d19) and the garment unit

Cards Plan & billing (current plan and balance, Get more credits, See plans), Members, Units, Account and Get more
credits, each opening its part below. The plan is Free for everyone until C1 records subscriptions.

The unit is a **person's**, not a brand's: `person_preferences (user_id, length_unit)`, `mm` | `cm` | `in`, no row
meaning millimetres. A person reads their own row; only `set_length_unit` writes it, from the server with the person
from the session. It is in the isolation test as a user-owned table; it holds no name or address, so it is not in the
erasure register, and it goes with the account (`on delete cascade`). The one helper is `lib/units/preference.ts`:
the shell's layout reads it once and hands it down through `LengthUnitProvider`; the tech pack view
(`usePreferredLengthUnit`) opens in it and the guided flow uses it when the address names no unit. Nothing stored
changes with it.

### 5. One plans modal, from config rows

`lib/plans/catalogue.ts` holds Free, Starter, Studio Pro and Club & Scale as rows with `isPlaceholder: true`: prices
in pence, credits, tech pack export limits and feature lines, the prototype's numbers. No component holds a price
(a test fails on a `£` digit in `components/plans`). `lib/plans/view.ts` works out the struck price, "Save £X
compared to monthly", "Save up to £X" and "Up to N images or M videos".

`PlansModal` draws two faces of those rows: **Choose Your Plan** (e42; Monthly | Annual, Starter / Studio Pro /
Club & Scale) and **Upgrade to export tech packs** (s19; Monthly | Yearly, Free / Starter / Studio Pro with export
limits). The shell mounts one `PlansHost`, opened through `lib/plans/modal-store.ts` by the top bar's Upgrade, by
Settings, and by every U1 `PremiumGate` that has no handler of its own (it rings the plan the gate names). Garment
Studio's Export ♛ (G1) opens it with `openPlans({ kind: "techpack" })`. A choose button says checkout is coming and
records nothing; purchase is C1's.

## Consequences

- The e2e specs that opened `/club`, `/collect` and `/brand-studio` open the new addresses; `e2e/team-brand-settings.spec.ts`
  covers the plans modal, Settings' unit, Team's tabs and retention, and Brand's import hand-off.
- The tab label is "Colours", not the spec's "Colors": the product's copy is British English throughout.
- `/orders/runs` (P5's) still links to `/club`; the 308 takes it to Team.

## Owner questions

1. Plan prices, credits and limits are the prototype's placeholders. Screen 29 (s19) gives Studio Pro 1,500 credits
   a month and 30 exports; e42 gives it 2,400. The rows use 2,400 for both modals. Which is right?
2. Free starts with 300 AI credits in the prototype, but the credit ledger's placeholder allowance is 10 a month.
   Which does a free brand get?
3. Should the Brand empty state's video slot hold a real video, and who makes it?
