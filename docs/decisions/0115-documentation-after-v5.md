# 0115: The documentation after plan v5

Status: Proposed. The map, the README and the checklist are rewritten against the files; the owner guide leads with the six things that stop a real order, and every owner question the thirty v5 records asked is collected into one list grouped by what kind of answer it needs.
Index: Proposed; the owner guide leads with what blocks a real order, and the 252 owner questions are collected into one grouped list
Index title: The documentation after plan v5
Date: 2026-11-02
Plan step: platform v5, wave 5, R4 (`plans/platform-v5.md`, "R1–R4. Review and hardening": "documentation (README,
architecture map, decision index, owner guide)").

## Context

Thirty workstreams merged between 2026-10-29 and 2026-11-02 and the documentation did not follow any of them.

`docs/architecture.md` described plan v4: it named `plans/platform-v4.md` as the current plan, listed 65 decisions when
there were 106, counted 78 route handlers when there were 95, and knew nothing of the base article catalogue, the rulebook,
the drafter, the production package, the factory model, the job packet, moderation, the Studio shell, Launch, compliance,
ops completion, the Store contract or Australia. `README.md` was the same vintage.

`docs/launch-checklist.md` said it was checked against the files on 2026-10-25 and had been overtaken. It also pointed its
reader at `docs/owner/open-decisions-2026-10-15.md` and said that file was "not in this repository at the time of writing"
and should be asked for or restored — a dead end at the top of the one list the owner is told to read first.

And the owner questions were scattered. Every v5 record ends with a section of them. There are **235** across the thirty
records, in thirty files, and nobody could see the shape of them: how many are money, how many one conversation with the
factory would close, how many need a licence bought, how many need a lawyer. Three separate records ask for a Pantone
licence; three ask for the white point; three ask whether a sock article is coming. Nothing said that four purchases stand
between the platform and its first real order.

## Decision

### 1. The owner guide says what is blocked, first, before anything else

`docs/owner/README.md` is new and is the owner's entry point. It opens with one sentence — **the platform cannot place a
real order today** — and then the six reasons, each with the evidence in the files:

| | What | Evidence read |
|---|---|---|
| 1 | **ISO 3758 is a paid standard and is not in this repository**, so no care line prints for any market, so no label prints, so the production package is refused for every market | `care_symbols` holds the five categories and nothing else, `symbol_ref` and `words` null; the table's own checks refuse words with no source and refuse a partial `confirmed` row; `tests/integration/compliance.test.ts` asserts the rows stay empty; `lib/kpp/input/labels.ts` reads `label_rules.care`, which the seed leaves null, and `lib/kpp/gate.ts`'s `labelIssues` refuses `label.care.length === 0`. Decision 0089 |
| 2 | **No AUD price exists** | `price_tiers.sell_aud_minor` null on all three tiers (`20261210030000_australia_and_translate.sql`); `tests/integration/store-contract.test.ts` asserts every row is null, and `lib/factory/view.test.ts` asserts an unpriced AUD row shows the empty string. Decision 0104 |
| 3 | **QC days and freight days are both unset, so no delivery date can be shown anywhere** | `production.qc_days` has `fallback: null` with the help text "Leave empty while none is agreed: no delivery date is promised"; `country_rules.freight_days` is seeded null; `lib/factory/dates.ts` answers "not set" when any part is missing. Decision 0071 |
| 4 | **No Pantone data ships** | `lib/crest-to-kit/palette.ts` says so in capitals; `lib/crest-to-kit/wording.test.ts` fails on any sentence matching `/\bpantone\s*[0-9]/i` across the surface. Decision 0105 |
| 5 | **Seven of the eight base articles publish no measurement at all** | `20261101010000_base_articles.sql` seeds `article_poms` for `JSY-SS-01` only; `lib/catalogue/seed/draft-article.test.ts` and `lib/parametric/articles/index.test.ts` assert the other seven hold no POM, range, option or construction and are refused in every size. Decision 0090 |
| 6 | **The hosted deployment is entirely owner actions** | The Supabase project and keys with the "Before user created" hook, Vercel Pro, Resend, Google OAuth, Turnstile with real keys, an EU Sentry project, AI keys with spend limits, and the `docs/legal/` documents approved with their `status` set. `docs/launch/sign-up-switch.md` |

Four of the six are purchases or decisions only the owner can make, and the guide says so in those words. It also says what
is *not* in the way, because the honest picture needs it: a real order also wants a signed-off golden sample, which is the
ordinary business of starting production rather than a gap in the platform.

The guide was written as a new file rather than folded into `docs/owner/settings-console-guide.md`, which is about one
screen. `docs/owner/` had no index; now it has one, and the README and the checklist both point at it.

### 2. The owner questions are collected, and grouped by what kind of answer each needs

`docs/owner/open-questions-v5.md` holds **252** questions: the 235 the thirty v5 records asked, plus the seventeen items of
2026-10-15 recovered in section 3 below. Each line is one question, in one sentence, with the deciding record cited; the
record stays authoritative and the detail is not copied out of it.

The grouping is the point of the document. A list of 235 questions in record order is not usable; the same list grouped by
who answers it is a work plan:

| Group | What answers it | How many |
|---|---|---|
| A | **Money**: a price or an amount only the owner can set | 21 |
| B | **A factory's or a supplier's figure**: the pattern master, the marker, the quote, the mill, the print house, the colour house | 59 |
| C | **A licence, a purchase or an account** | 20 |
| D | **A lawyer or an adviser**: legal, customs, copyright, retention | 17 |
| E | **A product decision**, Knitwright's alone | 112 |
| F | **A name against something**: a person who reads, confirms, reviews, translates or signs | 6 |
| P | The seventeen items of 2026-10-15 | 17 |

Group B is sub-grouped by what a conversation would cover — dates and terms, colour and quality, fabric declarations, the
pattern and the article data, consumption, the rulebook's own gaps — because it is one meeting, not sixty errands. Group E
is sub-grouped by the screen it is about. A question asked by more than one workstream appears once with every record that
asked it: the Pantone licence is three records, the white point three, the sock article three, the top bar five.

The six that block an order are also listed first, on their own, above the groups.

### 3. The file the checklist could not find never existed, and its content is here

`docs/owner/open-decisions-2026-10-15.md` has **never been in this repository**:
`git log --all --name-only | grep -i open-decisions` finds nothing on any branch. It was not lost and there is nothing to
restore. Both halves of its content are here and have been all along:

- **P1 to P17** are the table in **`plans/production-outputs.md` section 7**, "Owner input, and how work proceeds without
  it", one row each with what the platform does until the owner answers. `apps/web/lib/techpack/production/owner-inputs.ts`
  reads that section and is the code that shows them on the "Ready for the factory" list; its own doc comment names it.
- **A5** is **`docs/owner/size-charts.md`**, "Owner action A5: size charts for every garment family".

All seventeen are reproduced as group P of the question list with their v5 cross-references, so `P6` resolves to the Pantone
licence (C2) and `P10` to who signs (F6) rather than to a missing file. The checklist's paragraph now says this plainly
instead of asking for the file.

### 4. The architecture map is rewritten, and the two panel contracts get their own section

The thirty v5 workstreams are added as five tables, one per wave, each naming the `lib/` area it owns and the decision to
read. Every directory in them was checked to exist. The data flow is rewritten as thirteen steps from a start to a reorder,
through the catalogue, the drafter, the one pre-export checklist, the package, the golden sample, the release, the hand-off,
ops, the job packet and Launch.

Two files are given a section of their own, because other code — and, through the Store contract, another product — is
written against them, and because they are the same idea twice:

- **`apps/web/lib/editor/slots.ts`** (Y2, 0075): the seven editor slots, each given exactly `EditorSlotProps`. Every entry
  of `EditorCommands` is a request, never a write, so an unmanufacturable design is not something a panel is trusted not to
  make — it is something a panel has no way to express.
- **`apps/web/lib/launch/panels.ts`** (L1, 0091): the nineteen launch panels, following `slots.ts` deliberately, and naming
  the three invalid results it makes impossible — a disallowed connector, a paid run with no locked garment, a generated
  picture used as artwork.

`docs/store-contract-v2.md` (O2, 0106) is linked rather than restated.

### 5. "How this repository is worked on" is written down

A new section of the map, because the next person will otherwise get it wrong, and each item cost somebody a day: the one
shared local Supabase on fixed ports that nobody may start or reset, and `supabase migration up --local --include-all` as
the way to apply what landed since; the local run from `systemctl --user start podman.socket` and `DOCKER_HOST` through
`TURNSTILE_SECRET_KEY` and `OWNER_EMAIL` set by hand; the browser tests off the per-pull-request gate and the `e2e` label
that only works when it is passed **at creation**; the generated decision index; the two guards on identifiers and the three
collisions in one day that bought them (L2 and L4 on a migration hour, O3 and the top bar on 0103, and Z5 and Z7 on 0086 —
which reached `main`); shared files taking the union; interfaces before the other side exists; and committing after every
step.

### 6. Every claim repeated was opened and read, and four were wrong

The checklist's own preamble admitted it was weaker than its sources, and the brief for this workstream was not to make that
worse. Each "built" line and each "known gap" was checked against the files. What changed:

| Claim | Found |
|---|---|
| "`docs/owner/open-decisions-2026-10-15.md` ... is not in this repository at the time of writing. Its content could not be read" | **Wrong in effect.** The file never existed, and its content is in `plans/production-outputs.md` section 7 and `docs/owner/size-charts.md`. Section 3 above |
| "No email is sent by the platform: no invitation, no lead notice, no factory sheet" | **Two of three now false.** Share and design invitations send through Resend (`SHARE_EMAIL_*`, `lib/share/email-server.ts`, 0081), and customer status emails through Resend (`OPS_EMAIL_*`, `lib/ops/notify/`, 0100). Still true: no lead notice is emailed (`lib/leads/notify.ts` writes one log line), and the factory gets a tokenised link rather than a sheet (0072) |
| "`docs/decisions/README.md`, 65 records" (README) | **106 records**, of which 70 are still `Proposed`, 34 `Accepted`, one `Trial` and one `Open`. The checklist now gives those counts rather than the vaguer sentence it had |
| "the build plans (current: `plans/platform-v4.md`)" (README), "78 `route.ts` files" (map) | v5, and 95 |
| "Media sets per brand per day is stored but no code reads it" | **True, wrongly named.** The key is `media.daily_cap_per_brand`, and nothing outside `lib/settings/registry.test.ts` mentions it |
| "The guardrail settings saved in the console do not change the editor checks yet" | **True.** `loadGuardrailSettings` is exported from `lib/settings/read.ts` and has no caller outside `lib/settings` |
| "Nothing refunds credits on order yet (`orderDesignVersion` has no caller)" | **True.** Defined in `lib/credits-gate/server.ts`, called nowhere |
| Crest-to-kit's 95-of-100-crests acceptance test is owed evidence | **Wrong, and it was this pass's own first draft.** It runs in CI against generated fixtures: `lib/crest-to-kit/fixtures.test.ts`. Removed from the owed list; the benchmark reader's accuracy run (0084 q6) genuinely is owed |

Two further findings, recorded here because they belong to other people's work:

- **Decisions 0080 and 0085 have an "Owner questions" heading whose whole content is "Recorded in the pull request
  comment."** Those questions are on GitHub and nowhere in the repository, so they are not in the collected list and cannot
  be counted. They should be copied into their records. The count of 235 is therefore a floor, not a ceiling.
- **Pull request #140 (`fix/v5-wave4-wiring`, in flight) carries `docs/decisions/0106-wave-4-wiring.md`, and `0106` is
  already `0106-store-contract-v2.md` on `main`.** `tests/architecture/decision-index.test.ts` will fail on that branch the
  moment it merges `main`, which is the guard working; it needs renumbering to a free number before it merges. This record
  takes **0115** and not the next free number for that reason: R1, R2 and R3 are writing their own records in parallel and
  cannot see each other.

## Evidence

| Claim | Where |
|---|---|
| Every path and markdown link in the README, the map, the checklist, the owner guide and the question list resolves to a file that exists | `apps/web/tests/architecture/docs.test.ts` (new) |
| The one path named in order to be denied is still absent, and the checklist still explains where its content is | same |
| Every decision record is linked from the generated index, and each states a status | same |
| The index itself matches the records | `apps/web/tests/architecture/decision-index.test.ts` (existing), after `node scripts/write-decision-index.mjs` |

The new test found one real fault on its first run: the launch checklist's only unresolvable path, which is the one the
document now names in order to say it is not here. Ten other path assertions passed, which is the evidence that every other
path in these five documents resolves.

No dependency, no migration, no runtime code and no seed was touched. Nothing in `Sportswear/`, `kitwright/` or
`supabase/config.toml` was changed.

## Alternatives

- **Put the owner questions in the questionnaire sheets.** Rejected: the two sheets are answer sheets with a line to write
  on, organised by subject, and 235 more rows would bury the 48 that already have suggested answers. The new file is an
  index into the records and says in its own header to answer on the sheets where a question already appears there.
- **Group the questions by workstream, or by wave.** Rejected: that is the order they are already in, across thirty files,
  which is the problem. Nobody chases work by workstream; they chase it by who they have to call.
- **Leave the "built" table as a summary and not re-read the files.** Rejected explicitly by the brief, and it was right to
  be: four claims were wrong, one of them in this pass's own first draft.
- **Fold the owner guide into the launch checklist.** Rejected: the checklist is a gate with boxes to tick before sign-up;
  the owner guide answers "what state is this in", which is a different question asked more often and by more people.

## Consequences

- The owner has one list to work through and can see its shape: 21 prices to set, one meeting with the factory that closes
  most of 59 figures, 20 things to buy, 17 to ask a lawyer, 112 product decisions that can wait.
- A reader who follows a path in any of these five documents lands on a file, and a future edit that breaks that fails in
  CI in a second rather than rotting for three weeks.
- The five documents now carry counts — 106 records, 95 route handlers, 97 `lib/` areas, 76 migrations, 252 questions — and
  counts go stale. They were chosen over vaguer wording because a wrong number is noticed and corrected while a vague
  sentence is not. The next documentation pass should recount them; nothing enforces them.
- `docs/owner/open-questions-v5.md` is a derived document maintained by hand. The honest alternative is to generate it from
  the records, which would need every record to write its questions in one machine-readable shape — and two of them do not
  write them in the repository at all. That is the next step if this file is still useful in three months.
