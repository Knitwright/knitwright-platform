# 0083: Ask and best practice over the rulebook

Status: Proposed
Date: 2026-10-30
Plan step: `plans/platform-v5.md`, workstream Z2. Spec: `docs/spec/02-features.md` F-S5 (the v2 part) and its acceptance
tests, `docs/spec/01-product-direction.md` decision 11. Builds on decision 0067 and its revision of 2026-10-30
(workstream X2b, owner decisions 11 to 14).

## Context

Decision 0067 made the rulebook data and gave every rule a "Why?". F-S5's second half asks for three more things: an
**Ask** box scoped to the design, where a founder types a question in their own words and gets an answer that cites
the rules it came from; a **best-practice card** when a part is selected; and **tech-pack fields drafted from the base
article**, carrying the provenance the tech pack shows.

All three are places where a language model could state a manufacturing fact nobody wrote down. The spec's own
acceptance test is the measure: *"in a 50-question test set, 0 answers state a fact not in the rulebook"*. So the
interesting part of this workstream is not the model call. It is what refuses the model's answer.

## Decision

### 1. Retrieval is Postgres full text, scoped in SQL

`supabase/migrations/20261120020000_rulebook_search.sql`:

- a `search` column on `rulebook_entries`, `generated always as` a weighted `tsvector` of that version's own
  **applies-to** (weight A), **rule** (B), **why** (C) and **best practice** (D). Being generated, it cannot drift from
  the words of the version, and nothing writes it;
- a GIN index on it, and an index on `(rule_id, version desc)` — the one X2b's revision asked for before the table
  passes 500 versions;
- `rulebook_search(query, article_code, method, limit)`, which returns **rule ids and scores only**: the id, the
  `ts_rank`, how many of the question's searchable words the rule holds and how many were asked. The scope filter is
  the SQL twin of `inScope` (owner decision 12): asking about an article or a method matches only the rules that name
  it, and asking about nothing in particular matches every rule. The function is `security definer` and only the
  server's key may execute it; the `search` column is granted to nobody in a browser.

The query is built from the question's own lexemes, OR-ed, each quoted, and only lexemes of the form `[a-z0-9]+` are
searched. That is what keeps an address, a price or a rule id from carrying punctuation into a `tsquery`; an id in the
question is handled separately (point 3).

**pgvector: available, deliberately not used.** The extension ships in the pinned Supabase Postgres image (`vector`
0.8.2, confirmed from the image itself), so the plan's condition is met. It is still not used, for three reasons. A
vector search needs an embedding of every rule and of every question, which is a paid model call per question, against
the plan's own rule that the feature must degrade to a plain message with no key set. There is nothing deterministic to
test the *meaning* of an embedding against, so the retrieval quality it buys could not be asserted in CI. And the table
holds 46 versions of 46 rules written in one vocabulary, where weighted full text over four fields is exact and free.
Retrieval sits behind a two-method `Retrieval` port, so a vector backend is a later addition, not a rewrite. This is
owner question 1.

### 2. The grader, which is the point of the workstream

`lib/rulebook/ask/grader.ts` reads an answer four ways. The answer is shown only when all four find nothing.

1. **Every sentence names a rule.** A sentence with no `R-<FAMILY>-<NNN>` in it is a defect. Not a lower score: a
   defect, and the whole answer is dropped. A sentence nobody can trace to a rule is exactly the settled-sounding
   claim the wording rules exist to stop, however true it sounds.
2. **Every id was retrieved.** An id the search did not return is a defect, whether it is an invented id or a real
   rule the question never reached.
3. **The structured answer says the same as its words.** The ids each part records as data must be the ids written in
   it, so neither reading can be the one that quietly drops a citation.
4. **Every measurement is one the cited rule states.** A number with a unit (`lib/rulebook/ask/sentences.ts` reads mm,
   cm, m, in, pt, %, DPI, SPI, Tex, g, kg, gsm, MPa) that none of the cited versions holds is an invented measurement.
   A rule that writes a range once ("85–100% polyester", "0–6 mm") states both of its ends.

Sentences are split before any of this, so an invented sentence cannot ride into the answer inside a part whose other
sentence carries a citation. The fixed "not covered" words are the one part that may cite nothing, because there is
nothing to cite.

What the grader does **not** do is read a sentence for meaning. It cannot, and one that claimed to would be the weakest
part of the feature. What it guarantees is that every sentence is traceable to one rule and adds no measurement to it;
the rules' own words are shown beside the answer so a founder can check the restatement themselves.

### 3. The answering path, and its four endings

`askRulebook` (`lib/rulebook/ask/ask.ts`) takes a `Retrieval`, a `logGap`, a model (or null), the reader, and an
optional reservation. It ends in exactly one of four ways, and **three of them show no model's words at all**:

| Ending | What the founder sees |
|---|---|
| `not_covered` | nothing was retrieved, or the model itself said the rules do not answer it. The fixed words, carrying `R-GAP-000`, and the question written to `rulebook_gaps` under `ask:<the question>` so repeats of it count together. |
| `unavailable` | no key is set, or the allowance for asking is used up. A plain line saying which, plus the rules the search found in the rulebook's own words. |
| `ungrounded` | the grader turned the answer down, or the reply could not be read, or the call failed. The rules the search found, and **only the kinds of defect** — showing the offending sentence in order to explain that it is ungrounded would still be showing it. |
| `answer` | the model's sentences, each with the "Why?" link of the rule it cites, and the rules beside them. |

Retrieval applies owner decision 11 through `inForce`, with the server's key: a member is given only versions the
factory has signed off, with "a newer draft is waiting for the factory to confirm it" where a newer draft exists, and
nothing at all where no version is signed off. Since every seeded rule is a draft today, **a member's every question
answers "not covered" until the factory has been through the rulebook**, and the Knitwright team sees the drafts it is
writing. Nothing is read in the browser.

A rule the question names by id ("what does R-SUB-004 say?") is retrieved as well as searched, and still has to pass
both the reader check and the scope check, so naming an id is not a way round owner decision 12.

### 4. The model is an interface with a deterministic stub

The call goes through the existing `TextModelProvider` (`lib/providers/text-model.ts`) and the configured model
(`assistantModels()`), so no key means the feature degrades rather than fails. The instructions are fixed, the rules
are data, the question is fenced and labelled as a person's words, and the reply is structured output
(`{ covered, sentences: [{ text, ruleIds }] }`) parsed with zod. The cost of the one call is reserved against the
person's allowance before it is made (`askCost`, prices from `lib/providers/catalog.ts`, nothing priced here) and given
back when it fails. Every test uses `lib/rulebook/ask/fixtures/stub.ts`: no test and no run of the repository's own
tooling makes a paid call.

### 5. The 50-question set

`lib/rulebook/ask/fixtures/questions.ts` holds 50 questions: **45** founder-worded questions, one for each rule of
`docs/spec/articles/JSY-SS-01/rulebook.md`, and **5** the rulebook does not answer. The fixtures are the real 45 rules,
read through `lib/rulebook/markdown.ts`, so the set runs against the words a factory will read.

`questions.test.ts` runs all 50 four times over:

- all 45 answerable questions retrieve the rule they are about, and every answer is graded clean, citing only
  retrieved ids, with a citation on every sentence and no measurement outside the cited rule;
- all 5 unanswerable ones come back `not_covered` with a gap logged;
- the same 50 answers, each with **one** tampered sentence added, are **all** turned down — once for each of the four
  readings. A grader that only passed good answers would prove nothing; this is the half that matters;
- a member gets nothing while the rulebook is drafts; the team gets the drafts.

The unit tests run against a TypeScript twin of `rulebook_search` (`fixtures/search.ts`) so they need no database.
`tests/integration/rulebook-search.test.ts` holds the real SQL to the same bar in CI: the same 45 questions must each
reach their rule, the same 5 must reach nothing, and no browser may call the function or read the column.

### 6. The best-practice card

`bestPracticeCard` is the rulebook's own **Best practice** column for the rules that cover the selected part, at most
three lines, each with its rule id and that rule's "Why?". No model is involved. A part is matched to rules by topic
and by the words the rulebook itself names the part with (`PARTS`, data rather than prose in a function: collar,
sleeve, body, artwork, names, labels). Where nothing covers the part, the card says so and carries `R-GAP-000` rather
than filling the space with advice of its own.

### 7. Tech-pack fields drafted `from_base`

`overviewFields` drafts one overview sentence per row of the base article's construction table: the row's own seam
name, its own operation and its own stitch density, joined with punctuation, with the row's rule id and provenance
`from_base`. Nothing is composed and nothing is added where the row is silent — a row with no stitch density gets no
sentence about stitch density. The stitch density is quoted exactly as the row writes it ("12-14"), without adding
"per inch" where the row leaves the unit out, because that unit is R-CON-001's statement and not the row's.
`techpack-fields.test.ts` reads every drafted sentence back for measurements and checks each one against the row it
came from, so no number can enter a tech pack through this path.

## Honest limits

- **Nothing calls any of this yet.** `components/rulebook/ask/**` holds the Ask box, the answer and the card, but no
  page mounts them: the Studio's design surface is Y2's and the tech-pack view is Y4's. As with decision 0067's own
  "Why?" links, the member path is covered by the database test rather than a browser test, because there is no page a
  member can open the box on. The e2e specs come with the page that mounts it.
- **The grader cannot read a sentence.** A restatement that gets a rule's *sense* wrong without inventing a number or
  dropping a citation passes. The mitigation is that the rule's own words are shown beside the answer, not that the
  grader is cleverer than it is.
- **Full text is words, not meaning.** A question that shares no word with the rule it is about reaches nothing and
  answers "not covered". That is the safe failure, but it is a failure, and the gap list will show it: a gap logged
  for a question the rulebook *does* answer means the rule's wording, or retrieval, needs work. One of the 50
  questions had to be reworded for exactly this reason (the shoulder tolerance; R-FIT-003 states ±7 mm without using
  the word "tolerance").
- **`MIN_MATCHED` is two words.** One word in common is usually the topic alone ("seam", "fabric"), which is how a
  plausible answer to a question nobody wrote a rule for gets built. Two is a judgement, tuned against the 50
  questions, not a measurement.
- **The twin and the SQL could drift.** The TypeScript twin approximates Snowball stemming rather than running it. CI's
  database test runs the same 50 questions through the real function, so drift shows up there; nothing in the product
  uses the twin.
- The best-practice card's part vocabulary covers the parts the JSY-SS-01 rulebook was written for. Other parts are
  rows in `PARTS` when rules exist for them.
- The gap list now holds two shapes of code: rule ids (from a "Why?") and `ask:<question>` (from a question nothing
  covers). Both are the server's own write; neither can be filled from a browser with made-up rule ids.
- The 50-question set's own numbers, as the grader reports them: 45 of 45 answerable questions reach their rule, 78
  sentences across those 45 answers each carry a citation, 0 cite an id that was not retrieved, 0 state a measurement
  outside the cited rule, and all 180 tampered answers (45 × the grader's four readings) are turned down.

## Owner questions

1. **pgvector is available but unused** (point 1). Should Ask get a vector backend as well as full text? It would cost
   a paid embedding of every rule and of every question, and its retrieval quality could not be asserted in CI. The
   recommendation is to wait until the gap list shows questions that full text misses.
2. **Should a member be able to ask at all before the factory has signed the rulebook off?** Today every answer to a
   member is "not covered", which is correct under owner decision 11 but makes the box look broken. The options are to
   leave it (and not mount the box for members until the rulebook is signed off), or to show the drafts to members
   marked draft, which owner decision 11 rules out.
3. **Is `ask:<question>` the right key for the gap list?** It counts repeats of the same wording, not repeats of the
   same *question*. Two founders asking the same thing in different words make two rows.
4. **Who reads the gap list, and how often?** The feature's value depends on gaps becoming rules. There is no alert,
   only the list on `/admin/rulebook`.
5. **The stitch density is quoted without its unit** where the construction row leaves it out ("12-14"). Should the
   drafter add "per inch" from R-CON-001, or does that cross the line into stating something the row does not?
