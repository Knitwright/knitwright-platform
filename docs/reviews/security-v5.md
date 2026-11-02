# Security review of plan v5 (R1)

Reviewed 2026-11-02 at main `08a18ea2`. `main` was merged again before the final push and brought nothing new, because
`fix/v5-wave4-wiring` (#140) was still open — so the wave-4 wiring is **not** in what was reviewed; what it changes is
recorded under H1 instead. Scope: the platform only (not the Store, `Sportswear/`, `kitwright/`,
`supabase/config.toml`). All thirty v5 workstreams are merged;
this reviews the finished thing. No paid model call was made and no database was started — one local Supabase is shared
with the orchestrator, so the database findings were traced from the SQL and the new tests are left for CI to run.

Method: every migration from `20261101010000` to `20261210030000` read (28 migrations, 91 new tables, 153 function
definitions); the four table lists and the callable-function list of `apps/web/tests/integration/isolation.test.ts`
checked against the SQL table by table; every v5 function swept for its `revoke`; the public entry points traced from the
two lists that name them to their database functions; the secrets traced from `lib/config/env.ts` to every read site; the
client/server boundary checked by walking the transitive import graph of all 279 `"use client"` files;
`pnpm audit --prod --audit-level high` run.

## Result

**No CRITICAL finding. Four HIGH.** The headline is that **the garment lock can be defeated** — not by a missing check,
but because the one fact the lock turns on is a string the client sends (H1). Nothing reaches a factory print file today,
and no cross-brand data is exposed, but the record the lock keeps can be falsified and the mandatory "AI-generated" label
is lost on the hand-off to the Store. Alongside it: a credit idempotency key that collides on purpose if you pad a prompt
(H2), two of the three moderation hook points that were built and never wired (H3), and a read-only member who can spend
the brand's credits (H4).

Fourteen findings are MEDIUM and twenty-one are LOW. **Five are fixed in this PR**, each with a test that fails without it; the
rest are open, with an owner question where one is needed. None of the four HIGH findings is small enough to fix here —
each changes another workstream's design, and H1 needs a column on `public.files` that every store site must then set.

The v5 database work is the strongest part of the platform. Of 91 new tables, every one has row level security on, every
one is in the isolation suite's lists, not one brand-scoped table was filed in a list whose test lets another member read
it, and all 153 new functions are revoked from `public, anon, authenticated` with a fixed `search_path`. **No v5 function
is executable by `PUBLIC`** and **the browser-callable surface did not grow at all**: `CALLABLE` in `isolation.test.ts` is
unchanged from v4, so none of the thirty workstreams added a function a browser can reach. The fault L3 lost a CI round to
did not recur.

The findings are concentrated not in the new code but in the **guards that were supposed to watch it**: three of the four
invariants this review leaned on had a blind spot that let a real fault through (M1, M2, M3), and a fourth asserts nothing
at all about the server's own key (M5).

| Check | Result |
|---|---|
| `pnpm audit --prod --audit-level high` | No known vulnerabilities. |
| Dependencies added in v5 | One: `ajv` 8.17.1 (MIT), a devDependency. No new production dependency in thirty workstreams. |
| RLS on every v5 table | All 91 have it on. `isolation.test.ts` reads the list from the database (`public.security_report`), so a table cannot be added without an entry. |
| Every v5 table in the isolation suite's lists | Yes, all 91. Placement checked by hand: 46 in `TABLES` (cross-brand tests), 20 in `PLATFORM_TABLES`, 13 in `SHARED_TABLES`, 12 in `LIBRARY_TABLES`. **No table carrying a `brand_id` was filed in `SHARED_TABLES` or `LIBRARY_TABLES`.** But `LIBRARY_TABLES` ran no test — M1. |
| v5 functions revoked from `PUBLIC` | All 153. Four looked unrevoked; all four are `create or replace` of a v4 function at an identical signature, which keeps its privileges. Verified argument-type by argument-type. |
| Browser-callable functions | Unchanged from v4 (17 signatures, one of them `anon`). No v5 function is callable from a browser. |
| `search_path` on every `security definer` function | Asserted from the database by `isolation.test.ts`; no v5 function is missing it. |
| Append-only tables, service-role grants | Every brand-scoped v5 table grants the server's key `select` only; writes go through `security definer` functions. Direct DML is granted only on platform catalogue and library seed tables. **No grant was weakened to make a test pass.** But nothing asserts this — M5. |
| Public, unauthenticated surface | 25 routes and 13 pages, all listed in `lib/server/public-routes.ts` and `lib/server/public-pages.ts`; the lists match reality exactly. Five token kinds, all 256 CSPRNG bits, all SHA-256 at rest, all checked for expiry and revocation in the same `where`. |
| Token confusion | Not possible, structurally: five separate tables, each with a unique `token_hash`, each `open_*` function reading only its own. |
| Secrets | No committed `.env`. All six `NEXT_PUBLIC_*` names hold public values. No secret can reach the client bundle. No `console.*` in `app/`, `lib/` or `components/` except one fixed start-up warning. Eight variables bypass the env contract — M7. |
| The garment lock | Topology airtight (six enforcement points, all four orderings tried); provenance not enforced at all — H1. |
| Moderation | **One upload path of about eight; no generation path; no order path.** `screenGeneration`, `screenBeforeOrder` and `assertHumanReviewed` have zero production callers — H3. |
| Money | `CREDITS_ENFORCED` is off. The ledger is sound: refunds are once-only by constraint and nothing refunds twice. The risk is all in how idempotency keys are built — H2, M11, M12, M14. |

## Findings

### HIGH

**H1. The garment lock turns on a string the client sends, and `public.files` holds nothing that could answer instead.**
`apps/web/lib/launch/schemas.ts:81`, `apps/web/lib/launch/actions.ts:183-190`,
`supabase/migrations/20260929010100_files.sql:35`. The lock asks three questions. Two are answered server-side and are
airtight: *is this board a kind a model draws?* comes from `boards.kind`, which is immutable after insert
(`supabase/migrations/20261201010000_launch_projects.sql:333-335`, and `save_launch_board`'s update at `:372-379` never
sets it); *is there a generated board upstream?* comes from a recursive walk of `board_edges`. The third — *did this file
come out of a model?* — is answered by `asset.provenance`, a `z.enum(["deterministic", "golden_sample", "generated"])`
**in the request body**. There is no provenance column anywhere: `public.files` classifies by `kind` only
(`'artwork' | 'sketch' | 'photo' | 'render' | 'export'`), and a deterministic mockup and an AI lifestyle image are
**both** stored as `kind: "render"` (`apps/web/lib/media/service.ts:149`, `apps/web/lib/images/service.ts:112`), so nothing
in the database can tell them apart.

The sequence, which needs a member with `manageKit` on their own brand and nothing else: add a `design` board D and a
`mockup` board M, connect D → M, read any generated file id of the brand (`boards` is `select`-granted to `authenticated`
at `launch_projects.sql:226`), then call `recordBoardOutputAction` with
`asset: { role: "print_file", provenance: "deterministic", fileId: <the generated file> }`. Every gate passes.
`assetFrom` (`actions.ts:183-190`) rebuilds the asset verbatim and casts past the type system **on purpose** — its comment
says the cast is safe because "`acceptAsset` is the one thing that refuses such an asset", and that is the false premise:
`acceptAsset` (`lib/launch/assets.ts:86-108`) only enters its refusal branch when the body *admits* `"generated"`, so a
`mockup` board with `provenance: "deterministic"` falls through to `return { accepted: true, role }` at `:107`.
`set_launch_board_output` skips both of its refusals because `kind` is not `ai_image`/`ai_video`
(`launch_projects.sql:536-544`) and then checks only that the file belongs to the brand (`:546-550`). The CHECK constraint
`boards_generated_output_is_never_artwork` (`:128-130`) passes because it, too, tests `kind`, not the file. L6's trigger
`boards_artwork_never_comes_through_a_generated_board` (`supabase/migrations/20261201030000_flow_runs.sql:363-366`) walks
upstream, finds only a `design` board, and allows it.

**What this does not buy an attacker, honestly:** it does not put generated pixels into a factory print file. The print
builder reads artwork only from `user_artworks` — `apps/web/lib/print/inputs/context.ts:46` builds the reader,
`apps/web/lib/artwork-intake/reader.ts:30` queries `user_artworks` by id and brand, and
`apps/web/lib/print/layout/layers/graphic.ts:58-60` resolves both `{kind:"asset"}` and `{kind:"file"}` graphic sources
through that same reader — so a raw `files` uuid resolves to nothing and the layer is dropped. Nothing in the tree yet
consumes `boards.output_role = 'print_file'` to build anything, and the pattern/DXF path carries no raster at all.
**What it does buy:** (1) the mandatory AI disclosure is lost on the Store hand-off —
`apps/web/lib/flows/listing.ts:103,112` computes `label: generated ? "AI-generated" : null` from **graph topology**, so a
generated file sitting on a mockup board goes out to the O2 contract with `label: null`, which is exactly what
`apps/web/lib/flows/zip.ts:12-13` warns about in its own header ("A zip of pictures with no provenance in it is how an
AI-made scene ends up somewhere it was never allowed"); (2) the lock's own record is falsified, so any future consumer of
`output_role` makes it a real print file. The integration suite cannot catch it: `tests/integration/flows.test.ts:115-121`
codifies the final step as correct, and every test only ever offers an honestly-labelled generated asset.

Two further laundering routes share the root cause. `add_golden_sample_photo`
(`supabase/migrations/20261110020000_golden_samples.sql:354,366`) accepts any `p_file_id` whose only check is that it
belongs to the brand, and `golden_sample` is one of the two provenances an asset may claim that may be artwork or a print
file (`lib/launch/assets.ts:49`) — so a generated render can be recorded as a golden-sample photograph with no AI board
and no topology at all. And the marketing lock, which `apps/web/lib/marketing/assets.ts:5-23` describes as "the place
where a generated picture would reach artwork if anything could", shut "in three places", runs **only in the browser**:
the sole caller of `withPicture` is `apps/web/components/marketing/MarketingBoardPanel.tsx:59`, and the chosen file id is
persisted as plain settings jsonb that `save_launch_board` validates with nothing but
`jsonb_typeof(p_settings) <> 'object'` (`launch_projects.sql:357`).

**A note on `fix/v5-wave4-wiring` (#140), which was still open when this was written.** That branch makes H1 worse rather
than better: `components/launch/marketing-services.ts` builds the marketing panel's picture list by filtering out
generated *board kinds* and then hard-coding `provenance: "deterministic"` for every remaining board's output file,
without checking where that file came from — the same false premise as `assetFrom`, asserted as a constant. Its own
comment claims "nothing here can even name one". That assertion then satisfies `withPicture`
(`apps/web/lib/marketing/board.ts:163-164`, which builds an asset with `role: "panel_layer"`). Line numbers are not given
because the file is not in `main` at this commit; whoever lands H1's fix should treat that file as a fifth store site that
needs the file's real provenance, not a constant.

**Deferred: this is the one finding too large to fix in a review PR.** Smallest correct fix: add `provenance` to
`public.files`, set it at every store site, and have
`set_launch_board_output` read it from the file rather than take the caller's word. A cheaper interim: drop `provenance`
and `role` from `recordOutputBody` and derive both server-side from the board's kind and the file's own record, deleting
the deliberate cast. Also then: constrain `add_golden_sample_photo` to `kind = 'photo'`, move the marketing lock's three
checks to the server, and label `listing.ts` from the file rather than from topology. **Owner question: add a
`provenance` column to `public.files` now, or derive it server-side from the board kind as an interim? The first is the
real fix and touches every workstream that stores a file.**

**H2. A padded prompt makes paid shoots free: the credit idempotency key is truncated to 200 characters.**
`apps/web/lib/shoots/board.ts:182-201`. `idempotencyKeyOf` joins the board id and fourteen fields — including
`backgroundText` and `prompt`, both free text — and then calls `.slice(0, 200)` at `:200`, to fit the `1..200` check on
`p_output_key` (`supabase/migrations/20261201030000_flow_runs.sql:679`). The prefix `shoot:` plus a 36-character board id
plus the twelve short fields already runs to roughly 120-170 characters, so most of the prompt is discarded, and with a
long `backgroundText` **all** of it is. Pad `backgroundText`, then vary only the prompt: the first shoot is charged, and
every later, genuinely different shoot finds the key already in `credit_ledger` and returns `charged: false`. Unlimited
free paid generations once `CREDITS_ENFORCED` is on. Latent today — `runShoot` has no route, action or server caller — and
that is the cheapest moment to fix it. **Deferred, though it looks like a one-liner.** Replacing the slice with
`sha256(parts.join("|"))` is the right key, but `node:crypto` cannot go in that file: `lib/shoots/index.ts:13` re-exports
`./board` and three `"use client"` components import that barrel
(`components/shoots/ShootsPanel.tsx`, `BoardSections.tsx`, `AiImageBoardPanel.tsx`), so the hash must move to a
server-only module first. The widened boundary rule added in this PR (M2) is what catches that, which is a fair test of
whether it was worth adding. **Owner question: none — this is wave-6 work for whoever wires `runShoot`.**

**H3. Two of the three moderation hook points were built and never wired, and the spec's one named block rule is one function call away from working.**
`apps/web/lib/moderation/hooks.ts:82,119,134`. The spec is explicit — `docs/spec/02-features.md:948`, "**On every upload,
every AI generation and before every order**" — and the plan repeats it (`plans/platform-v5.md:759`). Across all of
`apps/web` there are exactly **two** production call sites of any screening hook: `app/api/artwork/route.ts:45` (through
`lib/moderation/server.ts:38`) and `lib/clubs/signup/actions.ts:168`. `screenGeneration`, `screenBeforeOrder` and
`assertHumanReviewed` have **zero** production callers — only their own tests and doc comments. Delivered coverage: one
upload path of about eight, no generation path of five, no order path of two. This is plan task 4's deliberate minimum
("wire `screenUpload` into the artwork upload path… the rest are wired in wave 2") and **wave 2's wiring never happened**;
the machinery itself — the hooks, the append-only store locked to `service_role`, the text rules, the ops queue,
takedowns — is well built. The sharpest instance: `apps/web/lib/moderation/text.ts:48-65` already implements the
`dupe` / `inspired by <brand>` / brand-name-in-title rules and `"title"` is in `TEXT_CONTEXTS` (`:13`), yet
`apps/web/lib/flows/actions.ts:147` writes `title: input.title` — free text from the body — straight into the Store
listing payload with no screen. "Nike dupe hoodie" ships. Two derived-artwork paths also skip a gate that exists:
`lib/design-import/derived.ts:28` calls `uploadArtwork` with no `screen` argument, and
`app/api/artwork/[artworkId]/change/route.ts:24` inherits the rights confirmation but not the moderation verdict, so a
flagged upload can be laundered into a clean-looking asset. Generated images are never screened at all
(`lib/images/service.ts:108`, `lib/media/service.ts:149`), mitigated for lifestyle scenes only because those prompts are
fixed. **Deferred: this is a wiring programme across about eight call sites, not a review fix.** The map above is the work
list. **Owner question: is the wave-2 moderation wiring now wave-6 work with a date, or is the delivered single upload
path the accepted scope for launch?** The answer matters because F-G2's validation check reads clean for every unscreened
target (M9).

**H4. A read-only member can spend the brand's credits, and the code says so in a comment.**
`supabase/migrations/20261025060000_credits.sql:227`. `credit_spend` checks membership and nothing else:
`if not private.belongs_to(p_user_id, p_brand_id)`. The v5 flows function does it properly and states the intended policy
verbatim: `supabase/migrations/20261201030000_flow_runs.sql:692-695` — "`credit_spend` asks only for membership; a viewer
should not be able to spend." Every credit-gated route is `auth: "member"` with no `requireAbility`. So a `viewer`,
described to users as someone who "cannot change anything", can empty the brand's balance through any pre-v5 paid path.
This is v4's M2 reopened and sharpened: v4 left it as "whether a viewer may spend credits is an owner decision", and v5
then wrote the decision down in a migration comment and applied it to the new path only. **Deferred: it is one line of
SQL, but it is the owner's call and it would change behaviour for every existing paid path.** Fix:
`private.can_manage_kit` with errcode `42501`, matching `flow_runs.sql`. **Owner question: confirm that a viewer may not
spend credits — the flows migration already assumes so — and `credit_spend` can be brought into line.**

### MEDIUM

**M1. `LIBRARY_TABLES` was a list in the isolation suite with no test behind it.**
`apps/web/tests/integration/isolation.test.ts:2548-2574`. Twelve tables (eleven of them new in v5: the rulebook, the
kit-font list, the template bundles and tech packs, the six flow templates, the shoot and model presets) are named in
`LIBRARY_TABLES`, which `isolation.test.ts:2655` counts towards "has a test below for every table" and `:2663` towards the
privilege check — and that is all. There is no `describe.each` over it, unlike `TABLES`, `PLATFORM_TABLES` and
`SHARED_TABLES`. The privilege check is no substitute: `security_report`
(`supabase/migrations/20260929010200_security_report.sql:28-34`) computes `client_privileges` by asking `anon` **and**
`authenticated` together and merging the answers, so a table granted `select` to `anon` reports exactly the same
`["SELECT"]` as one granted it to `authenticated`. What an attacker could do today: nothing — I checked all twelve grants
by hand and every one is `to authenticated`, never `anon`. What they could do tomorrow: read the whole rulebook, template
library and shoot catalogue without an account, with CI green, because the one list that is never tested is the one
holding the platform's reference data. **Fixed in this PR:** a `describe.each(LIBRARY_TABLES)` that asks anon directly.

**M2. The test that keeps server-only modules out of the browser covered 175 of 279 client components, and did not look for `sharp`, `server-only` or a Node builtin.**
`apps/web/tests/architecture/client-weight.test.ts:22,24-34,68,70`. `HEAVY` (`:22`) names six libraries —
`zod|three|read-excel-file|write-excel-file|@react-pdf/renderer|pdfjs-dist`. It does not name `sharp`. It cannot name
`server-only` at all, because both `HEAVY` and the traversal (`:58`) anchor on `from "…"`, while the guard is the
side-effect form `import "server-only"` with no `from`. `sourceFiles("components")` (`:68`) never reads `app/`, where six
`"use client"` files live, and `SECOND_PASS` (`:24-34`, applied at `:70`) excludes nine prefixes outright — 98 of the 273
client components under `components/`. Effective coverage: 63%. Nothing in the tree breaks it today (the full transitive
graph of all 279 client files was walked, following `import("…")` as well as static imports: zero reach `sharp`, zero
reach a `server-only` module, zero reach a `node:*` builtin — so the chain the launch-panels workstream hunted by hand is
**not reproducible at this commit** and is not reported here as live). The danger is a curated barrel: `lib/marketing/index.ts:1-8`
says in its own words that `export/render.ts` "carries sharp … none of which belongs in a page", and the barrel is imported
by eleven `"use client"` marketing panels. Adding one line to it would ship a native binary to the browser and the test
would stay green. Honest note for the record: even a client component importing `lib/config/env.ts` would **not** leak
`SUPABASE_SECRET_KEY` — Next.js inlines only `NEXT_PUBLIC_*` and turns other `process.env` reads into `undefined`, so
`getEnv()` would throw in the browser rather than leak. The cost of this gap is a broken page and a fat bundle, not an
exfiltrated key. **Fixed in this PR:** a second rule with no exclusion list, over every `"use client"` file in
`components/` and `app/`, following dynamic imports, reading the bare `import "server-only"` form.

**M3. Ten tables holding personal data were missing from the erasure register, two of them holding email addresses and one a phone number.**
`apps/web/lib/deletion/team-data.ts:14-47`. The register is what the platform reads to answer "what do we hold about a
person, and what removes it". Z7's nine committee and roster sign-up tables were absent, and so was Y8's `share_invites`.
Three hold real personal data about people who have **no account and so cannot delete it themselves**:
`committee_approvals.email` (`supabase/migrations/20261120050000_committee_signup.sql:243`),
`roster_signup_requests.phone` and `.email` (`:316-317`), plus the names in `committee_pins.name`, `committee_votes.name`,
`roster_signup_entries.name_on_shirt` and `share_invites.email`
(`supabase/migrations/20261110030000_share_invites.sql:52-57`). The data is in fact deleted: every one cascades through
`(link_id, brand_id)` or `(season_id, brand_id)`, the links cascade from `projects` and `club_seasons`, and
`committee-signup.test.ts:471-481,840` proves it. **So this is a register and documentation fault, not data surviving an
erasure** — which is why it is MEDIUM and not HIGH. What it would have cost: an erasure request answered from a register
that does not mention the three tables holding the addresses, and a reviewer told "the test fails if a table here stops
being removed". The test could never have caught it: `team-data.test.ts:8` reads a **fixed list of six migrations**, so a
table added by a migration nobody listed was invisible. **Fixed in this PR:** the ten entries, and the test now sweeps
*every* migration for a column holding an email address or a phone number and requires each table to be registered or
named in `ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER` with a reason. Both new sweeps fail without the entries.

**M4. The roster sign-up token was the one token in the address bar with no header rule and no log scrubbing.**
`apps/web/next.config.ts:88-95` and `apps/web/lib/server/log.ts:21-24`. `/s/:token` and `/job/:token` each get
`SHARE_HEADERS` (`no-referrer`, `noindex, nofollow, noarchive`, `private, no-store, max-age=0`) and each has a pattern in
`scrub` that replaces the token. `/join/:token` — added in v5, listed as a public page, and the one token page where a
**stranger writes a player's name** — had neither. The missing header is largely covered by the page's own
`metadata` (`app/join/[token]/page.tsx:31-32` sets `robots: noindex` and `referrer: no-referrer`), so the page's claim at
`:18-19` that "next.config.ts sets the headers" was simply false rather than dangerous. The missing `scrub` pattern is the
real half: `scrub` is what `monitoredLog` and the error-monitoring sender use (`lib/monitoring/monitor.ts:70,133,173`), so
a sign-up token in any log line or stack trace carrying an address **left the server in clear text, including to the
monitoring vendor**, while the equivalent share and job tokens did not. Anyone reading that log or vendor record could
then open the club's season and submit or overwrite a player's entry. **Fixed in this PR:** both added, and the header
test now runs over every token page rather than only the share one.

**M5. Nothing asserts what the server's own key may do to any table, so "append-only by grant" is a promise with no test behind it.**
`supabase/migrations/20260929010200_security_report.sql:28-34`. `security_report` reports `client_privileges` for `anon`
and `authenticated` only. It says nothing about `service_role`, and no other test reads those grants
(`grep -c service_role apps/web/tests/integration/isolation.test.ts` → 0). This is the one check in the brief for this
review that the codebase cannot make for itself. I did it by hand instead, simulating every `grant` and `revoke` in
migration order against Supabase's default privileges, and the answer is reassuring: **the server's key holds more than
`select` on 54 of 162 tables, and on none of the brand-scoped v5 tables.** Every one of the 54 is either platform
catalogue or library seed data (`base_articles` and its five children, `factories`, `price_tiers`, `country_rules`,
`flow_template*`, `shoot_*` presets, `template_kit*`, `marketing_*`, `care_symbols`, `aql_plans`, `translation_strings`,
`option_code_map`, `launch_artboard_presets`, `collection_freight_rates`) or a deliberate erasure path (`projects`,
`team_orders`, `share_links`, `share_responses`, `user_artworks`, `files`, `brands`, `memberships`). The ten tables with
no `revoke all … from service_role` at all are the pre-v5 core the server writes directly (`brands`, `memberships`,
`files`, `jobs`, `platform_admins`, `pattern_*`, `brand_size_charts`); **no v5 table is missing its revoke**, which
matters because Supabase's default privileges grant `service_role` everything on a new public table, so that `revoke` is
load-bearing on all 91. One anomaly fell out of the sweep — see L2. **Deferred: too large for this PR.** The fix is a
`server_privileges` field on `security_report` (additive, so no existing assertion changes) plus one
`expect(actual).toEqual(SERVER_WRITES)` in `isolation.test.ts` with those 54 names written down. That is a new migration
and 54 entries in the repository's most conflict-prone shared file, landed without the ability to run it locally.
**Owner question: should R1 land that invariant now, or is it wave-6 work?** The 54-name list above is the evidence
whoever does it should start from.

**M6. `/api/store/team-stores` hands the Store every club on the platform, with no hand-off gate.**
`apps/web/lib/store-contract/server.ts:204-213`. `serveTeamStores` selects `club_kits` for **all** brands (`brandId` is
optional, `schemas.ts:26`), and `teamStoreOf` (`:216-248`) then reads each brand's name, up to 20 `club_seasons` rows with
their names and dates, its `roster_signup_links.sport` and its newest `brand_products` row. Nothing requires the club to
have published anything. That contradicts the rule the contract states for itself one endpoint over:
`app/api/store/products/route.ts:12-14` — "A product is here because the platform holds a hand-off naming it … A product
nobody handed over is not in the answer at all" — enforced at `server.ts:180-181`. Drops and listings are inherently
hand-off records; team stores are the only one of the five that is not. What an attacker could do: nothing without
`STORE_SERVICE_TOKEN`, and the door is sound (see "Checked and found sound"). But that secret is a single static value
with no per-caller scope, so a leaked env var, a compromised Store deploy or a mis-set preview environment enumerates
every club on the platform, including clubs that never opted into the Store, with their season names and dates. This is
over-collection and blast radius, not an auth bypass. **Deferred: it changes O2's contract.** Smallest fix: restrict
`server.ts:207` to brands with at least one `collection_drops` or `flow_listings` row — the same `publicationsOf` test the
products endpoint already applies — or require `query.brandId`. **Owner question: is "every club" the intended answer for
team stores, or should it be gated on a hand-off like the other four?**

**M7. Eight environment variables, three of them real third-party credentials, bypass the env contract and `.env.example` — which reopens v4's L3.**
`apps/web/lib/inspiration/server.ts:41-42` (`UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`),
`lib/inspiration/sources/external.ts:32` (`PINTEREST_APP_ID`, `NEXT_PUBLIC_INSPIRATION_PINTEREST`),
`lib/shoots/adapter.ts:85,100` (`MEDIA_SHOOTS_LIVE`), `lib/media/video/encoder.ts:48-49` (`MEDIA_VIDEO_FFMPEG`),
`lib/design-import/switch.ts:7` (`DESIGN_IMPORT`), `lib/panel-layers/flag.ts:5` (`NEXT_PUBLIC_PANEL_LAYERS`). None is in
`lib/config/env.ts`; none is in `apps/web/.env.example`. v4's L3 was closed by putting exactly this class of variable
through `getEnv()` and documenting it (`docs/reviews/security-v4.md:72,128`); later waves reopened it. What an attacker
could do: nothing directly — all are read on the server and none is load-bearing for an access decision. The cost is
operational: a malformed key fails inside a request instead of at start-up, an operator has no file telling them these
exist, and `.env.example` no longer describes the deployment. `MEDIA_VIDEO_FFMPEG` names a binary path and is the one that
must not become unvalidated later; nothing spawns it (there is no `node:child_process` import anywhere in `app/` or
`lib/`), so there is no injection surface today. `MONITORING_DSN` is deliberately outside the contract
(`lib/monitoring/server.ts:7-11`, "so monitoring can never stop the app from starting") and should stay there.
**Deferred: it touches five workstreams' files.** Smallest fix: eight `.optional()` entries with the
`regex(/^\S{1,200}$/)` shape the sibling provider keys already use (`env.ts:77-78`), five call sites switched to
`getEnv()`, and a commented block in `.env.example`.

**M8. `takedown_notices` holds a third party's name and email address with no retention rule.**
`supabase/migrations/20261101070000_moderation.sql` — `reporter_name`, `reporter_email`, `decision_note`. The row is about
someone who is not a user of the platform and never agreed to anything; it is also the record of a legal complaint and of
what was decided, so erasing it with the brand would destroy the evidence. It is therefore deliberately **not** in the
erasure register, and this PR records that exemption with its reason in `ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER`. **Open.
Owner question: how long is a takedown notice kept, and who may read the reporter's address?** Nothing in the tree answers
either question today.

**M9. An asset nobody screened validates as clean, so every gap in H3 also passes the order gate.**
`apps/web/lib/validation/live-ports.ts:83` drops a target that has no stored moderation check from the answer, so
`moderationClear` (`apps/web/lib/validation/checks/moderation.ts:25`) raises nothing and F-G2's "moderation status
`clear`" holds for content that was never looked at. A check that never ran is being reported as a pass. The plan already
carries this as an open owner question (`plans/platform-v5.md:321`). Fix: return `result: "pending"` instead of dropping
the target — `moderation-pending` already exists as a rule id (`apps/web/lib/validation/rules.ts:39`). **Deferred: it is
X8/V1's design and it would turn every unscreened design amber until H3 is wired.** **Owner question: should an
unscreened target block "Ready for the factory", or warn?**

**M10. One design-write path skips the artwork-file gate.** `apps/web/lib/panel-layers/actions.ts:34`. Described in full
under "Could the garment lock be defeated?" above: `input.stack` is `z.unknown()` (`:19`), `refuseUnreadableArtwork` is
never called, and the stack schema permits an arbitrary file id as a graphic source
(`apps/web/lib/artwork-stack/layers.ts:74-77`). Mitigated on read for `spec.artwork` but not for
`spec.artworkStack.layers`, and the design-object export labels every placed asset `kind: "artwork"` with no provenance
(`apps/web/lib/design-object/layers.ts:72-73`). Behind `NEXT_PUBLIC_PANEL_LAYERS`. **Deferred:** the fix is to call
`refuseUnreadableArtwork` (or an equivalent over the stack's `{kind:"file"}` sources) before `append_spec_version`, which
is W2-G's code and needs its own test.

**M11. A retried flow run charges the whole pack again — the most likely way a real brand is billed twice on the day the flag flips.**
`apps/web/lib/flows/server.ts:60` keys the charge on `` `${runId}:${boardId}` ``, and `start_flow_run` mints a fresh
`runId` on every call (`apps/web/lib/flows/service.ts:95`). A server action is a POST: a double-click, a lost response or
a React double-invoke starts a second run with a brand-new key, and the full estimate for the pack is charged again — up
to 60 times per 10 minutes (`apps/web/lib/server/limits.ts:92`). A 14-board pack is a lot of credits. No attacker is
needed, which is why it is MEDIUM rather than HIGH, but it is the finding I would fix first for ordinary users. Fix: add
`requestId: z.uuid()` to `runFlowBody` and key on it instead of `runId`; better, a `unique (brand_id, request_id)` on
`flow_runs` so the retry returns the first run. **Deferred: it changes L3's request contract.**

**M12. The charge multiplier is a client-written field.** `apps/web/lib/flows/cost.ts:77` reads `board.settings["count"]`
(clamped 1 to 64) and `:85` multiplies the price by it, straight through to `p_units`
(`supabase/migrations/20261201030000_flow_runs.sql:691`). `settings` is `z.record(z.string(), z.unknown())` from the body
(`apps/web/lib/launch/schemas.ts:51`). The capability returns one asset, and the estimate agrees with the charge, so
`shownCredits` never notices: a board with `count: 64` is charged 64× for one picture. Harms the brand, not the platform,
which is why it is not HIGH — but it is a price the caller sets, which the plan's "data, not constants" rule exists to
prevent. **Deferred: L3's design.**

**M13. Flows charge while `CREDITS_ENFORCED` is off, and a client setting can make a paid board free.**
`apps/web/lib/flows/service.ts:186` spends without consulting the flag — `creditsEnforced()`
(`apps/web/lib/flows/server.ts:189`) only feeds the screens — so the one switch the launch checklist relies on does not
cover v5's main paid path. In the other direction, `apps/web/lib/flows/cost.ts:48-52` falls back to `settings.generation`
for any non-`ai_*` board kind and `apps/web/lib/flows/run.ts:267` attempts no charge at all when the estimate is zero,
while the board still runs. **Deferred: L3's design.** **Owner question: is flows charging regardless of
`CREDITS_ENFORCED` deliberate, or should it honour the flag like every other path?**

**M14. A shoot is free forever after one refund.** `apps/web/lib/shoots/board.ts:182` keys on the board and its settings
only, with no run or job id. Once a shoot of those settings has been refunded, the key is still in the ledger, so every
later identical shoot answers `charged: false`. The flows migration documents this exact failure and fixes it by putting
the run in the key (`supabase/migrations/20261201030000_flow_runs.sql:638-643`); shoots did not get that treatment. Fix:
include the `jobId` from `start_shoot_job`. Latent with H2 until `runShoot` has a caller. **Deferred.**

### LOW

- **L1. The share invite told the invited person "The link works for you alone", which is not true.**
  `apps/web/lib/share/public-load.ts:68-69` and `lib/share/email.ts:92`. `private.open_share_invite_row`
  (`supabase/migrations/20261110030000_share_invites.sql:99-112`) matches on `token_hash` only; the address the invite was
  sent to is never checked when it is opened. An invite is a bearer token, and forwarded it works for anyone. A member who
  believed the sentence might forward one, or send it over a channel they would not have used otherwise. **Fixed in this
  PR:** both say what actually happens. The e2e locator matches only the first clause, so it still passes.
- **L2. `share_invites`, `share_links` and `share_responses` grant the server's key `delete`, which nothing uses and nothing needs.**
  `supabase/migrations/20261110030000_share_invites.sql:86-87`, whose comment gives the reason as "Deleting a design or a
  brand removes these through their keys" — but a cascade does not need a grant on the child table. Z7's own migration says
  so in as many words: "No role is granted insert, update or delete on any of the nine. Deleting a design, a season or a
  brand still removes their rows: a cascade runs as the table's owner, which no API role is"
  (`20261120050000_committee_signup.sql:379-380`). So the grant is an unnecessary widening of a table documented two lines
  above as written "through the functions below and nothing else": it lets any server code path delete an invite outright
  instead of going through `revoke_share_invite`, which keeps `revoked_at` as the record. No code does
  (`from("share_invites")` appears once in `lib/`, a select). Not fixed: `share_links` and `share_responses` carry the same
  grant from v4, and revoking only the v5 one would leave the pattern inconsistent. **Owner question: revoke all three?**
- **L3. `scrub` misses several key shapes and two header forms.** `apps/web/lib/server/log.ts:11-18,27`. Covered:
  `sb_secret_`/`sb_publishable_`, JWTs, Postgres URLs, `sk-ant-…`, `sk-…`. Not covered: Gemini (`AIza…`), `FAL_KEY`,
  Resend (`re_…`, for `OPS_EMAIL_KEY` and `SHARE_EMAIL_KEY`), Google OAuth (`ya29.…`), `PHOTOROOM_API_KEY`,
  `FASHN_API_KEY`, and the random-string secrets. `LABELLED` (`:27`) anchors on `Bearer\s+`, so
  `Authorization: Client-ID <key>` (`lib/inspiration/sources/stock.ts:86`) and a bare `Authorization: <key>` (`:121`)
  escape it, and `token=` is not in the list, so a logged unsubscribe URL would keep its signature. No current call site
  puts any of these into a log — `where` is always a static label and every provider error is a fixed sentence — so this is
  for the next author.
- **L4. `CRON_SECRET`'s length floor lives in one place and is untested.** `apps/web/lib/config/env.ts:105` is
  `min(16)`; `lib/ops/schedule/cut.ts:28` checks only that it is non-empty, and the route reads it raw
  (`app/api/cron/ops-cut-batches/route.ts:25`). `STORE_SERVICE_TOKEN` has the second layer this lacks — the floor re-checked
  at the door (`lib/store-contract/admit.ts:58`) and a test file asserting it (`lib/store-contract/env.test.ts:20-43`).
  A one-character secret is refused at start-up, so this is defence in depth.
- **L5. `admitCron` leaks the secret's byte length.** `apps/web/lib/ops/schedule/cut.ts:32` short-circuits on a length
  mismatch before `timingSafeEqual`. An attacker timing many requests learns how long `CRON_SECRET` is and nothing more.
  The store side has the same shape (`lib/store-contract/token.ts:67`) but compares a fixed-width HMAC digest, so it leaks
  nothing.
- **L6. The five Store routes and the cron route are the only handlers in the app with no `Cache-Control`.**
  `app/api/store/route.ts:22-23`, `products/route.ts:25-26`, `drops/route.ts:22-23`, `listings/route.ts:22-23`,
  `team-stores/route.ts:22-23`, `app/api/cron/ops-cut-batches/route.ts:26,28`. All six return `Response.json(...)`
  directly and so bypass the `no-store` that `lib/server/core/create-define-route.ts:70-71` puts on everything else. On
  Vercel this is harmless — function responses with no `Cache-Control` are not CDN-cached. The exposure is a shared forward
  proxy between the Store and the platform: RFC 9111 permits heuristic caching of a 200 `GET` with no freshness
  information, and these bodies are cross-brand.
- **L7. Viewing a share, committee or sign-up page is limited per address but never per link.**
  `app/s/[token]/page.tsx:59-60` and `app/join/[token]/page.tsx:45-46` count only `…:address:<addr>` (60/min). Every
  **write** on these surfaces does have a per-link counter (`lib/share/committee/respond.ts:42`,
  `lib/clubs/signup/submit.ts:66`), and the job packet downloads have one. A committee page renders up to three design
  versions server-side and shrinks each one's artwork (`lib/share/committee/public-load.ts:43-57`), so one leaked committee
  link gives 60 such renders per minute per source address and N addresses give N×60 — meaningful CPU amplification against
  a dynamic page. It needs a valid link, and it is the posture decision 0026 accepted for share pages.
- **L8. The job-packet photo upload is the one public write with no bot check.**
  `app/api/job/[token]/photos/route.ts:21-31`. Per-address and per-packet limits, the token must open a packet before the
  body is read, and the image is sniffed and re-encoded — but no Turnstile, where committee writes
  (`lib/share/committee/respond.ts:35-40`) and roster sign-up (`lib/clubs/signup/submit.ts:59-69`) both fail closed
  without `TURNSTILE_SECRET_KEY`. Pre-v5 (decision 0072) and defensible: the caller is a named factory, not a stranger off
  a search result, and the per-packet cap is 20 per 10 minutes.
- **L9. The `gate` job does not aggregate the secret scan.** `.github/workflows/ci.yml:147` is
  `needs: [checks, e2e]`; the `secrets` job (`:20-36`, invariants plus gitleaks over the full history, pinned by digest) is
  not among them, although the gate exists to be "the one name to require". Branch protection requires
  `Secret scan and invariants` by name as well, so **this is not a live hole** — recorded because the gate's own comment
  claims otherwise. Smallest fix: add `secrets` to `needs` and assert its result.
- **L10. Invariant I1 would miss an environment file not named `.env*`.** `scripts/check-invariants.sh:9` matches
  `(^|/)\.env($|\.)`, so a stray `apps/web/env.local` or `secrets.env` would pass. Nothing like that is committed.
- **L11. The Store's 503 names the environment variable.** `lib/store-contract/admit.ts:26,28-29`: with no secret set any
  caller is told `STORE_SERVICE_TOKEN is not set on this deploy`; with one set but a bad token, 404 plus `howToSign()`
  naming the header and the canonicalisation rule. A stranger learns whether a deploy is configured and reads a how-to. No
  secret material leaks and the contract is public, and the choice is documented (`lib/server/public-routes.ts:46-49`).
  The cron route is the same shape (503 missing, 404 wrong).
- **L12. On the Store routes, the query schema is validated before the token is verified.**
  `lib/server/core/create-define-route.ts:146` (rate limit) → `:157-163` (`parseInput`) → `:167` (the handler, where
  `admitRequest` lives). An unauthenticated caller gets 400 for a schema-invalid query and 404 for a well-formed one, and
  so can map the query schema without a token. No database read happens before admission.
- **L13. `clientAddress` falls back to one shared bucket.** `lib/server/core/client-address.ts:34-36` returns
  `"unknown"` when the trusted header is absent, so a misconfigured `CLIENT_ADDRESS_HEADER` would let one attacker exhaust
  `read:address:unknown` (120/min) for the Store contract, the cron route and forty other route files at once. The default
  (`x-vercel-forwarded-for`) is right for the target host and the direction is fail-closed. A configuration hazard, carried
  over from v4's S-03.
- **L14. The platform catalogue takes direct DML from the server's key rather than going through checked functions.**
  `price_tiers`, `country_rules`, `factories`, `factory_capabilities`, `programme_fabrics` and the `base_articles` family
  all grant `insert, update` (some `delete`) to `service_role` — see M5 for the full list. These rows set prices, lead
  times and country rules, so a bug in any server path holding the key could rewrite them without passing a function's
  checks. Every writer is admin-guarded today (`tests/architecture/ops-access.test.ts:61-62` now covers
  `lib/pattern-service`, `lib/designers`, `lib/settings` and `lib/moderation`). Defence in depth.
- **L15. The `/s/[token]` handler tries three kinds in turn, so a valid token's kind is weakly distinguishable by
  response time.** `app/s/[token]/page.tsx:76-77` and `lib/share/service.ts:219-225` try `open_committee`, then
  `open_share`, then `open_share_invite`. Useless to an attacker, who already holds the token. Noted for completeness.
- **L16. With no vision key, every image reads clean.** `apps/web/lib/moderation/image.ts:43` emits
  `vision_not_configured` at severity `"note"`, which `verdictOf` maps to `clear`
  (`apps/web/lib/moderation/types.ts:56`), whereas a *failed* call correctly flags (`image.ts:53`). So with no model key
  the F-G1 offensive-content filter on images is simply off and every upload is recorded as having passed. The asymmetry
  with the failure path looks like an oversight rather than a choice. Fix: make `vision_not_configured` a `"flag"`, or put
  it behind a platform setting. **Owner question: with no vision provider configured, should an image upload be clear or
  flagged for a person to look at?**
- **L17. Text a person can read is screened in one place and not in the others.** Design text layers (names and slogans)
  are never screened — `apps/web/lib/validation/spec-input.ts:21-33` emits only `kind: "asset"` targets, though `"text"`
  is a valid `TargetKind` (`apps/web/lib/moderation/types.ts:11`). A roster name typed by a committee member through
  `app/api/club/seasons/[seasonId]/roster/route.ts:30` is unscreened while **the same field submitted through the public
  sign-up link is screened** (`lib/clubs/signup/actions.ts:168`), which is the wrong way round only in that the signed-in
  path is the unchecked one. Also unscreened: the assistant prompt
  (`app/api/projects/[projectId]/intent/route.ts:37`), the public factory job-packet photo
  (`app/api/job/[token]/photos/route.ts:22`), proof and golden-sample photos
  (`app/api/projects/[projectId]/proofs/photos/route.ts:23`), and `/api/files` entirely
  (`app/api/files/route.ts:34` → `storeImage`, with no moderation import in that file or in `lib/storage/store.ts`). All
  part of H3's wiring programme.
- **L18. The Store contract promises a screen that does not exist.**
  `apps/web/lib/store-contract/personalisation.ts:51` tells external storefronts that "A name or a number the Store takes
  is screened again by Knitwright before it reaches a print file." No such screen exists (H3). Not fixed here because
  changing a sentence in a published contract is O2's call and the owner may want the screen rather than the correction.
  **Owner question: implement the screen, or correct the contract?**
- **L19. A refund that fails on order is lost permanently.** `apps/web/lib/credits-gate/order.ts:23-30` logs and returns
  `refunded: null`; its comment says "calling again is safe", but nothing calls again, and the ordered-status trigger
  (`supabase/migrations/20261101030000_design_validation_v2.sql:38-39`) makes a retry impossible. The brand is out of
  pocket, not the platform.
- **L20. `credit_refund_spend` is an unbounded "refund any of my brand's spends" primitive.**
  `supabase/migrations/20261201030000_flow_runs.sql:731-756`: no board or job binding, and alone among that file's
  functions it omits the `can_manage_kit` check. Safe today only because its single caller passes a server-derived id.
- **L21. Smaller money notes.** Two key namespaces both charge `marketing_media` for one design version, contradicting the
  "charged once" comments at `apps/web/lib/credits/service.ts:96-99` and `lib/credits-gate/with-credits.ts:33-38`; a
  member can write a false `last_cost_credits` through `recordOutputBody` (display only — it never reaches the ledger);
  `usage_reserve` has no idempotency key and no sweeper; the estimate reads the settings store while the charge reads the
  `credit_prices` table, so the two can disagree; and the two pattern-service functions take their locks in opposite
  orders.

## Could the garment lock be defeated?

**Yes — see H1.** The honest summary: the lock has two halves, and they are of very different quality.

**The topology half is airtight.** L1's three application refusals, L6's three triggers and the CHECK constraint together
cover every ordering I could construct on paper. `boards.kind` is immutable after insert, so the obvious attack —
promote an upstream board to `ai_image` after the fact — is refused by the CHECK. The trigger at
`supabase/migrations/20261201030000_flow_runs.sql:363` fires `after insert or update of output_role, output_file_id,
settings`, so the insert-clean-then-update trick does not work; `:419` fires on `from_board_id, to_board_id`, so adding
the generated board *after* recording the output is caught; `:451` fires on `update of settings`. I tried all four
orderings and could not get through. The recursive upstream walk handles multi-hop chains correctly. The fifth check the
wiring change adds asks the same question of the same data and is consistent with the other four.

**The provenance half is not a lock at all.** It is an assertion by the caller. Every enforcement point above tests either
the board's kind or the graph's shape — never the file. `public.files` has no column that could answer the question, and
because a deterministic mockup and an AI render are both `kind: "render"`, no column could be inferred either. So a member
with `manageKit` can hand the platform a generated file and tell it the file is deterministic, and all six checks agree.

Two things make this less bad than it sounds, and I want them on the record so nobody over-reads the verdict. First, the
print path does not consume `files` ids at all — artwork comes from `user_artworks`, so no factory print file can be
reached this way today. Second, the attack is a member lying about their own brand's asset; it crosses no tenant boundary
and reads nobody else's data. What it defeats is the platform's **own promise**: spec decision 13, the "AI-generated"
label on the Store hand-off, and the integrity of the record the lock keeps.

**Download-and-re-upload is not caught, and nothing in the tree claims it is.** Only `uploadArtwork`
(`apps/web/lib/artwork-intake/service.ts:21`) and `changeArtwork` (`:149`) insert into `user_artworks`; `brand_assets`
points only at `user_artworks` with a brand check (`supabase/migrations/20261110010000_brand_studio.sql:150,415-420`), and
moodboard items hold URLs with no file id (`supabase/migrations/20261120010000_inspiration.sql:48-74`). So re-upload is
the only route by which generated pixels could reach a print file, and that claim is honest rather than papered over.
Worth telling the owner: `apps/web/lib/moderation/image-hash.ts` is already a 128-bit perceptual hash built for exactly
this shape of question, so hashing every generated output at generation time would make re-upload detectable. That is the
only real defence against that class, and it is a feature, not a fix.

**One write path does skip the artwork gate.** `apps/web/lib/panel-layers/actions.ts:34` passes a client-supplied artwork
stack (`input.stack` is `z.unknown()` at `:19`) to `designWithStack` and saves it as a new design version without calling
`refuseUnreadableArtwork`, whose only three callers are in `apps/web/lib/projects/service.ts:134,191,252`. The stack
schema permits `graphic.source = {kind:"file", fileId:<any uuid>}` (`apps/web/lib/artwork-stack/layers.ts:74-77`), so this
is the one design-write that skips the `files.kind = 'artwork'` check at `apps/web/lib/projects/artwork-files.ts:22`. It is
mitigated on read, not on write: `dropUnreadableArtwork` (`apps/web/lib/projects/project-reads.ts:201,300`) removes
`spec.artwork` entries whose file is not the brand's artwork, and the 2D canvas draws a dashed placeholder — but that
filter does not touch `spec.artworkStack.layers`, and the design-object hand-off exports every placed asset as
`kind: "artwork"` with no provenance (`apps/web/lib/design-object/layers.ts:72-73`). It sits behind
`NEXT_PUBLIC_PANEL_LAYERS === "on"`. Recorded as M10.

## Money

`CREDITS_ENFORCED` is off, so none of this charges anyone today; that is exactly why it is worth reading now. **There is
no credit reservation anywhere** — credits are spent outright, with no reserve, capture or void. The only reservation in
the tree is the platform-cost meter `usage_reserve`.

**The ledger itself is sound and should not be touched.** `credit_ledger` has `unique (brand_id, idempotency_key)` and
`unique (refund_of)` (`supabase/migrations/20261025060000_credits.sql:58-59`), is append-only by trigger (`:90-96`), and
every read-then-write takes a per-brand advisory lock. Both refund functions are genuinely once-only — a
`not exists (… r.refund_of = s.id)` guard inside the same statement, plus the unique constraint:
`credit_refund_for_order` (`:270-279`) and `credit_refund_spend`
(`supabase/migrations/20261201030000_flow_runs.sql:731-756`). `credit_spend_output` reads the price from `credit_prices`
and never from the caller (`flow_runs.sql:685-693`). `usage_refund` is atomically idempotent
(`supabase/migrations/20260930050000_monthly_allowances.sql:184`). **There is no catch-and-finally double refund
anywhere, and nothing refunds twice.** The double-charge risk is all in how keys are built — see H2, M11, M12 and M14.

Paths that spend outside the gate object: `apps/web/lib/flows/service.ts:186`, `lib/pattern-service/service.ts:63` and
`lib/kpp/sources/server.ts:55`. Of these, **flows never consults `CREDITS_ENFORCED` in its charge path** —
`creditsEnforced()` at `apps/web/lib/flows/server.ts:189` only feeds the screens — so flows will charge while the flag is
off. That is M13. `lib/marketing`, `lib/mockups`, `lib/inspiration`, `lib/translate`, `lib/moderation` and
`lib/benchmarks` spend no credits at all.

## Moderation

See H3 for the finding. The shape of what exists is good and worth describing, because the gap is wiring rather than
design: `moderation_checks` is append-only with `service_role` holding `select` only, the text rules implement every rule
the spec names, the ops queue and takedown flow work, and `apps/web/lib/shoots/run.ts:44` declares its `screen` dependency
**non-optional** and calls it at `:149` before keeping anything — which is the shape every other generation path should
copy when it is wired. Two secondary faults are recorded as M9 and L16.

## Every v4 finding re-checked

The v4 review (`docs/reviews/security-v4.md`) left nine findings fixed in application code, seven fixed in the database and
three needing the owner. All sixteen fixes are still in place at this commit:

| v4 finding | Still fixed |
|---|---|
| M1 template submission needs `manageKit` | Yes — `lib/designers/actions.ts:38` calls `requireAbility(session, "manageKit")`. |
| M3 `_private` counted against the quota | Yes — `lib/storage/private-usage.ts` exists and `lib/storage/store.ts:6` uses it; `MEDIA_SET_RESERVE_BYTES` is 12 MB (`lib/media/video/limits.ts:15`). |
| M4 deletion empties `_private/<brand>` | Yes — `lib/deletion/storage.ts:13`. |
| M5 `set_brand_details` needs `can_manage_members` | Yes — migration `20261030010000`, unchanged. |
| M6 `save_club_kit` checks file ownership | Yes — unchanged. |
| M7 admin check before the body is read | Yes — `authorize` on `create-define-route.ts:50,155`, used by the ops pattern-file route. |
| M8, L8 column-level grants | Yes — `20261030020000_member_visible_columns.sql`, and v5 added to the pattern rather than undoing it (`20261201050000_template_kinds.sql:56` grants `templates (kind, sport_tags, era_tags, mood_tags)`, not the whole table). |
| L1 write rate limits | Yes. |
| L2 Postgres `details` out of the log | Yes — `lib/server/log.ts:48`. |
| L3 provider keys through `getEnv()` | **Partly reopened** — the v4 keys are still in `env.ts`, but eight new variables bypass it. See M7. |
| L4 `nosniff` on media responses | Yes — both routes. |
| L6 fal download read in pieces | Yes — `lib/media/video/fal.ts:25,64`. |
| L7 `fabricKey` checked against the profile | Yes — `lib/brand-runs/place-order.ts:29`. |
| L9 to L13 database fixes | Yes — migrations `20261030010000` and `20261030020000` are untouched by v5. |
| L14 `ASSISTANT_SIGNING_KEY` | Yes — `env.ts:119,285`. |
| L15 `ops-access.test.ts` scope | Yes, and widened: it now also walks `lib/moderation` and the ops review route. |
| M2 viewers spending credits | **Still open, still the owner's.** Unchanged in v5, and v5 added paid paths (shoots, video, marketing, mockups, translate) on the same footing. |
| L5 `CREDITS_ENFORCED` default | **Still open, still the owner's.** Off by default; the start-up warning remains. |
| L16 the watermark is removable | **Still open.** Inherent. |

## Checked and found sound

**Tokens.** All five kinds are `randomBytes(32)` base64url — 256 bits (`lib/share/token.ts:9-15`,
`lib/job-packet/token.ts:9-13`). None is ever stored: each table keeps `sha256(token)` in a `bytea` with a unique index
(`share_links`, `share_invites`, `committee_links`, `roster_signup_links`, `job_packets`). Each `open_*` function is a
single equality against that unique index with `revoked_at is null and expires_at > now()` in the same `where`, so an
unknown token, a revoked one and an expired one take one code path and give one answer. The shape is pre-checked in
application code, so a malformed token never reaches the database. No public surface takes an incrementing id. Token
confusion is structurally impossible: five tables, five `open_*` functions, each reading only its own, so a committee
token at `/join` and a roster token at `/s` are both `notFound()`.

**The Store contract (O2).** Both claims hold. The **payload kind** is inside the HMAC body
(`lib/store-contract/token.ts:48`) and rejected before anything else when it does not match the endpoint's literal
(`:61`); `app/api/store/routes.test.ts:109-113` proves a token for another endpoint is 404. The **query digest** is inside
the signed body (`:48-49`) and compared at `:64`. A member's session is **explicitly not a key**: `auth: "public"` means
`admit` never calls `getSession` (`lib/server/core/guard.ts:73`), there is no session branch anywhere in
`lib/store-contract/`, and `routes.test.ts:119-129` calls the handler with a full owner session and no token and gets 404.
The MAC is compared with `timingSafeEqual` (`:67`) behind a length guard; expiry (300 s) is checked before the signature;
a secret shorter than 32 characters after trimming gives 503 before any comparison (`admit.ts:56-58`), so empty,
whitespace or undefined can never match. One nuance worth writing down: `admit.ts:52` digests the raw URL while the
handler executes the parsed query, and the two diverge on duplicate keys and empty values — but every divergent shape is
rejected with 400 by `parseInput` before the handler runs (`z.uuid()`, `z.coerce.number()`), so there is no replay to
another brand. Ideally the digest would be taken over the object the handler reads.

**The cron route.** It does answer 503 without its secret (`lib/ops/schedule/cut.ts:28`), 404 with a wrong one (`:32`),
and the comparison is `timingSafeEqual`. `runScheduledCut` and `ops_cut_scheduled` have no caller outside tests, so there
is no way to trigger cron work without the secret.

**What a valid token reveals.** The committee view shows no other visitor's name, vote or pin; the share page shows no
answers; `/join` shows only the club name, the season name, the number range, the name length and the size guide
(`lib/clubs/signup/public-load.ts:57-68`). A visitor is identified only by
`sha256(link_id || ':' || visitor_key)` (`20261120050000_committee_signup.sql:522-535`), which cannot follow a browser
between links. The write side is bound too: `committee_pin`, `committee_vote` and `committee_approve` all constrain the
visitor-supplied `version` and `slot` to that link's own `committee_link_versions` rows (`:778-782,823-827,875-879`), so
an approval cannot be recorded against a version the link does not show.

**Secrets.** No committed `.env` (`git ls-files` shows two `.env.example` files and nothing else). All six
`NEXT_PUBLIC_*` names hold public values: the site address, the Supabase address, the publishable key, the Turnstile
**site** key and two feature flags; the secret halves live under separate names read only on the server. The only
`console.*` in `app/`, `lib/`, `components/`, `proxy.ts` and `instrumentation.ts` is the fixed start-up warning at
`lib/config/env.ts:276`. No environment object is ever logged or serialised; `where` is always a hard-coded label, never a
request URL. `describeIssue` (`env.ts:241-251`) builds a start-up error from the issue *path* only, so a malformed secret
never reaches it. `withoutEmptyStrings` (`:238-239`) turns `FOO=""` into absent, so an empty secret fails closed instead
of matching. `guardedSchema` (`:186-207`) still refuses a deploy that sets a Turnstile test site key or test secret, an
`AI_PROVIDER_STUB=on`, a missing `UNSUBSCRIBE_SECRET`, or `PATTERN_PROVIDER=claude-bridge` without an owner address. The
monitoring sender reuses `scrub` and additionally strips email addresses (`lib/monitoring/monitor.ts:67,70`), loads no
vendor SDK, and cannot throw into a request. There is no `node:child_process` import anywhere in `app/` or `lib/`.
`.gitleaksignore` holds one narrow fingerprint, not a path exclusion.

**The public lists.** `lib/server/public-routes.ts` (25 entries) and `lib/server/public-pages.ts` (13) match the set of
`auth: "public"` entry points exactly — no omission, no stale entry — and `tests/architecture/page-guard-check.ts:66-92`
enforces both, refusing to let a studio or admin page be made public by listing it.

## Not reviewed

The Store itself, `Sportswear/`, `kitwright/` and `supabase/config.toml`, all out of scope. The artwork-intake PDF parser
beyond confirming again that SVG is never stored. Load verification of the rate limits still needs a deployment
(`docs/launch/evidence.md`), and the hosted Supabase settings still need checking against
`docs/runbooks/supabase-hosted.md` before sign-up opens — both owed since the pre-beta review.

## Fixed in this PR

Each fix has a test that fails without it. No migration was added, so no timestamp was claimed.

| Finding | What changed | The test that fails without it |
|---|---|---|
| M1 | `describe.each(LIBRARY_TABLES)` in `isolation.test.ts` asks anon directly for each of the twelve library tables. | `library table %s > shows a visitor who is not signed in nothing` (CI, database). |
| M2 | A second rule in `client-weight.test.ts` over every `"use client"` file in `components/` **and** `app/`, with no exclusion list, following `import("…")` as well as static imports, and reading the bare `import "server-only"` form. | `keeps sharp, the Node builtins and every server-only module out of every client component`. Verified by adding `export * from "./export/render"` to `lib/marketing/index.ts`: the new rule names eleven marketing panels reaching `sharp`; the old weight rule stays green. |
| M3 | Ten entries in `PERSONAL_DATA_TABLES`, a documented `ADDRESS_HOLDERS_OUTSIDE_THE_REGISTER`, and two sweeps that read *every* migration instead of a fixed list of six. | `every table in every migration that holds an email address or a phone number is registered, or exempt with a reason` and `every brand's own table the committee and sign-up migration creates is registered` — both fail with the entries removed. |
| M4 | `{ source: "/join/:token", headers: SHARE_HEADERS }` in `next.config.ts`; a `SIGNUP_TOKEN` pattern in `scrub`. | `removes the token of a roster sign-up link too` in `lib/server/log.test.ts`, and the header test now an `it.each` over all four token pages. |
| L1 | The invite note and the invite email say that whoever holds the link can read the design. | `lib/share` unit tests; the e2e locator matches only the first clause. |

## Open, by who decides

| Finding | Needs |
|---|---|
| **H1** | **Owner:** add a `provenance` column to `public.files` now, or derive it server-side from the board kind as an interim? The first is the real fix and touches every workstream that stores a file. Until one of them lands, the "AI never draws the garment" principle is enforced on topology only. |
| **H2, M14** | **Orchestrator:** wave-6 work for whoever wires `runShoot`. Hash the key instead of slicing it, and put the job id in it. The hash must live in a server-only module — three client components import the `lib/shoots` barrel. |
| **H3, M9, L17, L18** | **Owner:** is the wave-2 moderation wiring now wave-6 work with a date, or is the single delivered upload path the accepted launch scope? And should an unscreened target block "Ready for the factory", or warn? |
| **H4** | **Owner:** confirm a viewer may not spend credits — `flow_runs.sql:692-695` already assumes so — and `credit_spend` can be brought into line. This is v4's M2, now answerable. |
| M5 | **Owner/orchestrator:** land the `server_privileges` invariant now, or wave 6? The 54-name list is in M5. |
| M6 | **Owner:** is "every club" the intended answer for `team-stores`, or should it be gated on a hand-off? |
| M7 | **Orchestrator:** eight variables into `lib/config/env.ts` and `.env.example`; touches five workstreams' files. |
| M8 | **Owner:** how long is a takedown notice kept, and who may read the reporter's address? |
| M10 | **Orchestrator:** call `refuseUnreadableArtwork` from `savePanelLayersAction` (W2-G's code, needs its own test). |
| M11, M12, M13 | **Owner for M13** (should flows honour `CREDITS_ENFORCED`?); **orchestrator for M11 and M12**, both in L3's request contract. M11 is the one to fix first for ordinary users. |
| L2 | **Owner:** revoke the unused `delete` on `share_invites`, `share_links` and `share_responses`? |
| L16 | **Owner:** with no vision provider configured, is an image upload clear or flagged? |
| L3 to L15, L19 to L21 | **Orchestrator**, each small and independent. None is exploitable as the code stands. |
| v4 M2, L5, L16 | **Owner**, unchanged since v4: may a viewer spend credits; the `CREDITS_ENFORCED` default; the watermark. |
