# 0112: The v5 code review, and the four guards it closed

Status: Proposed. `docs/reviews/code-v5.md` is written; four small fixes are made, each with a test that fails
without it; twenty-one duplicate implementations, ninety-six unwired seams, 102 distinct rule gaps and ten
invented-value findings are recorded there for their own workstreams and for the owner.
Index: Proposed; code review of all thirty v5 workstreams, four guards closed, 21 duplicate implementations and 96 unwired seams recorded, owner questions listed
Index title: The v5 code review
Date: 2026-11-02
Plan step: `plans/platform-v5.md` wave 5, R2 (code review). Reviews against "Rules every workstream follows" and
"Lessons". Reads, and does not change, the thirty records 0066 to 0108.
Migration: none.

## Why this number

0106 is `store-contract-v2` on `main`, 0107 is claimed by `fix/v5-wave4-wiring` (#140, whose own branch still calls
its record 0106 and will renumber on merge), 0108 is the unowned launch panels, and R1, R3 and R4 were each writing a
record of their own while this one was written. 0112 leaves room for all three rather than racing them. 0109 to 0111
may therefore be free when the dust settles; 0088, 0097 and 0107 were already noted as unused numbers by this review's
seam sweep, so a tidy-up of the gaps is one job, not three.

## Context

Thirty workstreams wrote plan v5 in parallel, in thirty branches, by agents who could not see each other's work. That
is where this review's findings come from, and it is worth saying which way round: the parallelism did not produce
sloppy code. It produced **the same careful thing built twice**, by two authors who each reasoned correctly from the
same rules and did not know the other existed.

Eight of the twenty-one duplicate groups are self-declared: the second author left a comment saying they were copying
and that the two should become one. L7's is the clearest — *"The same list as `lib/benchmarks/fetch.ts`, which does
not export it; when either directory is next opened the two should become one exported constant"* — and it names the
cause as well as the fact. Z3 did not export its private-host regex. There was no barrier of any other kind: the two
directories import freely from one another.

## Decisions

1. **A reviewer fixes a guard, and reports a design.** The four changes here are all guards: a scan that did not read
   what it claimed to, a constant two modules declared twice, a register missing nine tables, and a plan rule nothing
   enforced. Every finding that would change what a user sees, what a factory receives or what another workstream
   decided is in `docs/reviews/code-v5.md` with its recommendation and its owner question, and nothing else was
   touched. No migration, no `Sportswear/`, no `kitwright/`, no `supabase/config.toml`, and
   `apps/web/vitest.config.mts` is unchanged.

2. **The settled-words scan reads each root recursively.** `lib/techpack/wording.test.ts` listed one folder at a time,
   so the folders a workstream added below a scanned one were never read: `lib/techpack/exports/**` (the whole 16-page
   PDF and the Excel writer), `lib/techpack/view/**` (the view models) and four of the five registry families, the
   `teamwear` family v5 added among them. Nothing in them breaks the rule today, which is luck rather than design:
   they hold sentences the scan would have stopped on, and `lib/techpack/view/fields.ts` renders a chip whose word is
   **"Confirmed"**.

   Three sentences are now allowed, each of which says nothing has been checked. The chip is allowed in its one file
   through a **per-file allowance**, a new mechanism with three rules a test enforces: it may hold a word and never a
   sentence, it must say why in more than a line, and it applies to no other file. The chip's word is not this
   workstream's to rename — it is spec F-S6's own fourth provenance word and X5's `FIELD_PROVENANCE` key from
   `docs/spec/04-production-package.md` (decision 0070), so the tech pack view and the package a factory receives
   label a value's source with the same word by design. Allowing it in one place, with the reason written down, is how
   a reviewer records that rather than quietly widening the rule for everybody.

3. **One list of addresses that are not a public web page**, `lib/http/public-url.ts`, which is what L7 asked for. It
   lives under `lib/http` because it belongs to no feature: anything on the server about to fetch an address a person
   typed should ask it. The two copies were byte-identical, so **nothing about which address is refused changes**.

   What the module adds is a header saying what the check is **not**. It does not follow a redirect — and both callers
   fetch with `redirect: "follow"`, testing only the address as typed, so a public page that answers 302 to
   `169.254.169.254` is still followed. It does not resolve the name. It reads only the four-part form of an IPv4
   address, so `127.1`, `0x7f.0.0.1` and `2130706433` pass. Of IPv6 it knows `::1` alone. It says nothing about the
   port, or about `100.64.0.0/10`. Each of those is a finding for the security review (R1) rather than a change made
   here, because fixing any of them changes what a fetch does; the point of the move is that there is now **one place**
   a fix has to go instead of two, and a test that fails if a third copy appears.

   `lib/inspiration/sources/link-preview.ts` and `lib/inspiration/server.ts:102` fetch a URL with **no private-host
   check at all** — and the second takes its address from a third-party page's `og:image`, so the URL is
   attacker-reachable. That is left to R1 too: it needs a refusal reason in Z1's own vocabulary, which is a design
   decision, not a guard.

4. **Z7's nine tables are on the personal-data register.** `PERSONAL_DATA_TABLES` is the list of what holds people's
   names, and the test beside it is what proves each one goes with its design, its order or its season. The committee
   link and roster sign-up tables were on neither, and they are the only tables in the product a person **with no
   account** writes to: a pin's body is free text that can name anyone, a vote and an approval carry the name the
   person typed, an approval carries their email address when one was offered, and the two sign-up tables carry
   players' names, numbers, phone numbers and email addresses.

   Nothing about the database changes. The rows already cascade from `committee_links`, `roster_signup_links` and
   `club_seasons`, and the migration's own comments say they are removed with the season. What was missing was the
   register, and so the guard — and the guard was missing because its test reads a **fixed list of migrations**, so a
   new migration holding names is invisible to it by construction. The test now reads Z7's migration, checks the key
   shape of all nine, and fails if a table that migration creates is neither listed nor one of the four platform rule
   tables that hold nobody's data. That is the shape the ops-QC, club and comments migrations already had; decision
   0087 asked for it.

5. **The 400-line file rule has a test.** "Files under 400 lines and functions under 50" is one of the rules every
   workstream follows and nothing enforced either number: the v4 review counted them by hand, this one counted them
   again, and both times the file rule held while the function rule did not. This holds the one that is true, over
   `lib`, `app` and `components`, and names any file that goes over. It deliberately does not freeze a count of the
   one that is not: the four `lib` functions still over 50 lines are recorded as findings for their own workstreams,
   and a second rule belongs beside this one once they are split.

6. **Three HIGH findings are deferred, and each is deferred for the same reason.** Each would change a decision another
   workstream made, so each is an owner question rather than a fix:

   * `credit_spend` requires only brand membership where `credit_spend_output` requires `can_manage_kit`, and the
     second function's own comment names the discrepancy. The weaker check is on the main spend path. Also referred to
     R1.
   * `lib/crest-to-kit/decode.ts` rasterises a vector crest at 150 DPI and Brand Studio's two decoders at `sharp`'s
     default 72, while three comments assert the three agree. For an SVG or PDF crest they can return different
     palettes.
   * `article_poms` has `not null` tolerance columns and no row-level provenance, so it cannot represent "no tolerance
     agreed" — which means the gate that refuses a null tolerance can never fire for a catalogue POM — and its figures
     reach `pom.csv`, which has no provenance column. Its two siblings, `bom_consumption` and O1's `ops_aql_*`, both do
     this properly, and the plan says in terms that a missing tolerance is a question for the factory.

7. **The ninety-six seams are reported as one table and not as defects.** Every one of them is a workstream that
   stopped at its boundary and said so, which is what Lesson 9 asked for. The table exists so that none of them is
   anybody's surprise, grouped by what closes each: a component nothing mounts (22), an interface with only a test
   double (12), a database column nothing writes (21), one-line cross-workstream wiring (22), and an owner decision
   with no code to write (19).

## Consequences

- The wording guard now covers every folder under the roots it is given, so a folder added under one of them is read
  without anyone remembering to list it. The per-file allowance is a new, narrow mechanism; if a second entry is ever
  wanted, the test's rules are the argument for whether it should exist.
- There is one private-host list, and a test that fails if a second appears. The list's limits are written down where
  the list is, so the next reader cannot mistake it for a complete SSRF guard — which is the mistake four other
  fetchers in the tree have already made in one form or another.
- The personal-data register covers the public-facing tables, and its test now grows with Z7's migration rather than
  with a hand-maintained list.
- One plan rule out of two is enforced. The other needs four functions split first.
- No `R-GAP-000` is used by this workstream: it writes no rule, range, option or field. It counts other
  workstreams' gaps — 102 distinct subjects in 14 groups, 29 opened more than once — and hands the count to X2, which
  is the only workstream that can close one.

## Owner questions

1. **May a viewer spend a brand's credits?** `credit_spend` says yes, `credit_spend_output` says no. One of the two is
   wrong and the weaker one is live.
2. **Should a vector crest be read at 150 DPI everywhere?** Doing so changes the palette Brand Studio shows for an SVG
   or PDF upload.
3. **Should `article_poms`' tolerances be nullable with provenance columns, as `bom_consumption` has, and should
   `pom.csv` carry a provenance column?** Today an unsourced tolerance reaches a factory file unmarked.
4. **Should `SEAM_TOLERANCE_MM` (2 mm), `REDUCTION_TOLERANCE_PCT` (0.5) and `DEFAULT_GAP_MM` (5 mm) become labelled
   settings?** The first two decide a "ready for the factory" item and print into sentences a user reads; the third
   silently moves a fabric-consumption estimate and is named in no assumption.
5. **Should `erase_committee_pin` and `erase_signup_entry` exist?** None of Z7's nine tables can be erased on its own:
   a pin, a vote and an approval are append-only by trigger and a sign-up entry has no erase function, unlike
   `roster_players` and `club_invitations`. A committee member who asks for their words to be removed can be answered
   today only by deleting the whole design.
6. **Which of the twenty-one duplicate groups should be merged, and by whom?** Each names its winner in the review.
   The cheapest three are `lib/design-import/marks.ts:90` (delete one line, import the identical exported function one
   directory away), the four copies of the react-pdf document shell (two of which carry real defects — a missing page
   footer and a title that skips the font-coverage guard), and the literal `£` at
   `app/(ops)/ops/factories/sections.tsx:38` on a value that may be AUD.
7. **Two screens print a different number for the same thing.** `lib/crest-to-kit` reports CIEDE2000 and
   `lib/brand-studio` CIE76 for the same distance from the sublimation-safe colour; and the order modal says "no total
   yet" for a basket the quote PDF gives a figure for, because one uses the strict total and the other a partial one.
   Which is right in each pair?
