# 0096: Flows, the launch pack on one canvas (L6)

Status: Proposed; every credit figure is a labelled placeholder, every flow pack is a labelled default nobody has reviewed, owner questions listed
Date: 2026-11-02
Plan step: platform-v5 L6 (F-L4 of `docs/spec/02-features.md`, the flow templates of `docs/spec/07-template-library.md`)

## Context

F-L4 is the feature that makes the rest of Launch worth having. A mockup is one picture and a post is one post; a
flow is one design becoming a whole launch — fourteen assets for a club kit — in one press, and again next week for
the away kit without a prompt being typed twice. The spec's own acceptance tests say exactly that:

> The Club kit launch pack produces 14 assets in under 10 minutes.
> Swapping the design and pressing **Run all** regenerates every output without re-entering prompts.

L1 had already built the canvas this runs on (decision 0091): `boards` and `board_edges` with an input index, the
spec's board table as data and as SQL, `canConnect`, `garmentSource`, `runnable`, `runOrder`, and a panel contract
whose `LaunchCommands` already carried `connect`, `disconnect`, `requestRun` and `requestRunDownstream`. So the
question for this workstream was not "what is a graph" but "what does running one honestly require", and the answer
had four parts: an order, a price, a refund, and a rule about what the output may be used as.

## Decision

1. **Nothing here keeps a second graph model.** A flow is L1's boards and connectors, read through L1's own
   `canConnect`, `runnable`, `garmentSource` and `runOrder`. `lib/flows/topology.ts` adds only what L1 does not
   answer: a Kahn pass over the whole canvas, for a Run all that starts from no particular board, and the set of
   boards a failure takes with it. `templates/templates.test.ts` wires each of the six packs through `canConnect`
   edge by edge, so **a pack cannot describe a canvas a person could not have wired by hand**.

2. **The hole a chain of boards could open is closed, in the application and in the database.** This is the most
   important thing in the pull request. L1 shuts three doors on a generated picture becoming artwork — the asset
   union, `acceptAsset`, and the schema's own constraint — and all three ask the same question: *is this board one a
   model draws?* For one board that is the whole question. A chain can ask it of the wrong board:

   > Design → Mockup → AI image → AI image → **Marketing** → "print file, please"

   Every hop is legal and the Marketing board is one the platform draws itself, so all three doors open. The pixels
   came through two AI boards.

   So `lib/flows/artwork.ts` asks it of the whole branch: **a board with a board a model drew anywhere behind it may
   not record its output as a layer on the garment or as part of a print file**, however many hops away. The run
   engine refuses such an output and gives the credits back, and the database refuses the row in **three** places,
   one for each order the trick can be done in — because each order changes a different row, and a trigger only sees
   the row that changed:

   | order | what changes | what refuses it |
   |---|---|---|
   | record an artwork output on a board with an AI board behind it | `boards.output_role` | `boards_artwork_never_comes_through_a_generated_board` |
   | make a clean board's output artwork first, then connect an AI board into it | `board_edges` | `board_edges_artwork_never_comes_through_a_generated_board` |
   | leave a clean board feeding an artwork board, then mark it a model scene | `boards.settings` | `boards_a_model_scene_never_feeds_artwork` |

   `garment-lock.test.ts` walks the four-hop chain in the application and `tests/integration/flows.test.ts` walks all
   three orders in the database. Only the first was in the first draft of this workstream; the second and third were
   found by reviewing the migration, which is the strongest argument for the review being part of the work.

3. **A run is charged per board, and a board that fails gives its credits back before the next one starts.**
   `credit_spend` charges once per output kind and design version, which is right for a tech pack PDF and wrong for a
   launch pack: it would mean one charge for fourteen boards and nothing to give back when the thirteenth failed. So
   the flow migration adds two functions beside the existing ones: `credit_spend_output`, which keeps that
   idempotency and adds the run and the board to the key, and `credit_refund_spend`, which gives back one spend
   rather than every spend on a design version. The ledger line still names the plain design version, so the
   existing "credits come back when the design is ordered" refund still sweeps a flow's spends up.

   The key holds the **run** as well as the board on purpose. Keyed by the board alone, a retry after a refund would
   be free: the key would already be in the ledger and the second model call would cost nothing. Within one run the
   key does not change, so a retry inside a run is free, which is the promise the platform already makes.

   `credit_spend_output` also takes **how many** of its output the board makes, because an AI Image board asks for one
   to four pictures (F-L1) and charging once for four would be a quote the ledger did not keep. The quantity is a
   count, never a price: the price is only ever read from `credit_prices`.

   And because a capability is another workstream's code reaching a model over a network, **a call into it is a value
   and never an exception**. A rejection that escaped the run engine would leave a board charged with no refund made
   and no row written, which is the worst thing this directory could do; `run-failures.test.ts` is the test for it.

4. **The estimate comes first, and it is checked three times.** `estimateFlow` is shown on the button and at the top
   of the run panel before anything is spent; a paid run asks again before it starts; the action re-works the estimate
   out from the canvas and the platform's own credit prices and **refuses a run that now costs more than the figure
   the person was shown**; and — the one that holds when the other two have been got round — **the run refuses any
   charge that came back larger than the figure that board was quoted**, gives it straight back and fails the board.
   The figure on the button is the most that may ever be taken.

   The panel has no price of its own: without a cost source it says the price could not be read and Run all is off,
   because a zero would be a lie on the one screen that promises not to tell one. For the same reason a board's own
   settings may only ever make it **more** expensive: `generation` is read from the kind first, so a written
   `"deterministic"` on an AI board cannot make a paid model call free.

5. **A Mockup board can cost credits, and the spec's own table says so** ("free if deterministic, credits if AI
   scene"). L1 prices a board by its kind, which would price three of the Club kit pack's scenes at nothing, so
   `lib/flows/cost.ts` reads how a board is made from the board's own settings and prices that. Per-second video
   pricing comes in the same way: until L5's model list is configured a clip is counted as one generated picture and
   the note says so, rather than being counted as free.

6. **A scene a model makes is an AI Image board, not a Mockup board with a flag.** `07`'s Club kit flow calls the
   three teamwear scenes mockups; F-L1 says what an AI scene actually becomes — "each result appears as an AI Image
   board" — and L1's `acceptAsset` refuses a generated picture on a Mockup board. Following F-L1 keeps the garment
   lock, the "AI-generated" label and the refund working on them. The count of fourteen is unchanged.

7. **The six packs are rows, seeded from one place in code.** `lib/flows/templates/**` is where a pack is written
   down, and the migration seeds `flow_templates`, `flow_template_steps` and `flow_template_links` from it, exactly as
   the credit prices are set in one file and seeded from it. `migration.test.ts` parses the migration and fails when
   the two disagree on a pack, a step, a connector or a count.

   They are **not** rows of `templates`. That table's `snapshot` is a design validated against the registry, and a
   flow is a shape rather than a design. L8 made the same choice for kit bundles and tech pack templates (decision
   0098), and following it means `lib/templates/service.ts` keeps reading one kind of row: **the design library needs
   no narrowing from this workstream**, and whoever lands a `templates` row of another kind still owes it.

8. **A pack is opened on the server, in one save.** `addBoard` of the panel contract gives a panel no id back, and a
   pack with fan-in needs the ids of the boards it has just added. So `applyFlowTemplate` plans the boards and the
   connectors (pure, tested) and carries the plan out through L1's own `save_launch_board` and
   `connect_launch_boards`, which means every board and every connector goes through the checks L1 built. A person
   also sees the pack appear at once rather than a board at a time.

9. **The canvas works without a mouse.** A node canvas that needs dragging is a canvas half the people who open it
   cannot use. Selecting is a button per board; moving is the arrow keys through the same `moveBoard` a drag uses,
   with a live region saying where the board went, and four labelled nudge buttons for a pointer that is not a mouse;
   connecting is "Connect from here", which lists every board this one may feed with the input it would take and, where
   it would be refused, L1's own sentence for why. A connector is drawn by choosing from a list instead of by aiming
   at a dot. All of the maths is in `lib/flows/canvas.ts` and tested without a browser.

10. **Flatten, Upscale and Reframe are a settings change plus a rerun**, not three new kinds of picture. Each
    therefore goes through the garment lock, the estimate and the refund. Flatten is free and never changes where a
    picture came from — a flattened AI picture is still scenery. Upscale and Reframe are free when the platform can
    draw the picture again and cost when a model has to, and a size outside what the canvas draws is refused with the
    bound in the message rather than quietly clamped.

11. **"Publish to store" publishes nothing.** Owner decision 1 keeps the Store out of this platform. The button
    writes a listing payload — which finished pictures a listing may use, their labels, and the true-colour picture to
    show beside each AI scene (F-L1's own rule) — into `flow_listings`, append-only, for wave 5's Store contract (O2)
    to collect, exactly as a collection drop is collected. `listing.test.ts` reads every field name in the payload and
    fails on anything about price, cart, checkout, stock, payout, shipping or a storefront. The one change an
    append-only hand-off allows is being marked collected, and `collect_flow_listing` is the only thing that may make
    it: the table grants nobody UPDATE, so without that function the exception in the trigger would be dead letter.

12. **Export all is a zip with a folder per format, and the provenance travels with the files.** It carries no clock
    and sorts every entry, so the same outputs give the same bytes, as the job packet already does. It also holds
    `contents.txt`, naming every file, the board it came from and the "AI-generated" label where there is one: a zip
    of pictures with no provenance in it is how an AI-made scene ends up somewhere it was never allowed.

13. **An info card invents nothing.** The size chart is garment measurements and says so, because the spec's returns
    rule depends on it; a measurement, a weight or a care symbol the platform has not been given is shown as missing,
    with the rule that explains it, and the heading counts how many are missing. The facts come in through
    `InfoCardSource`, the smallest interface this panel needs, with a double.

14. **No model is called and nothing is charged today.** Every capability is an interface; `capabilityOf` hands every
    board to a deterministic stub until L2 to L5 register theirs, and `capabilities.ts` says per kind what is wired,
    what is stubbed, and which files-service operation (X5, decision 0070) the real one would use. `CREDITS_ENFORCED`
    is off, so the meter reports that nothing was charged and the summary says so, rather than printing a figure
    nobody paid.

## Evidence

* `apps/web/lib/flows/**`: 278 tests over the six packs, the order, the estimate, the run, the refunds, the branch
  check on artwork, the three operations, the summary, the zip, the listing payload, the canvas maths and the keyboard
  paths, and the reads and writes. 98% of statements, 93% of branches, 99% of functions and lines.
* `apps/web/lib/flows/acceptance.test.ts`: the spec's own two tests. The Club kit pack makes **14 assets** with the
  stubs, and swapping the Design board's version and pressing Run all **regenerates all fourteen with not one prompt
  re-entered** — proved by comparing every board's settings across the two runs and every output file between them.
* `apps/web/lib/flows/garment-lock.test.ts`: the four-hop laundering chain, refused at the last hop, credits given
  back, nothing recorded.
* `apps/web/lib/flows/migration.test.ts`: the seeded packs against the TypeScript ones, the kind, generation and
  format lists against L1's and this directory's, and the grants.
* `apps/web/tests/integration/flows.test.ts`: the database's own behaviour — both halves of the artwork rule on a
  four-hop chain, the run rows, the append-only hand-off, one charge per board and one refund per charge, and the
  seeded packs.
* `apps/web/tests/integration/isolation.test.ts`: the three run tables and the three template tables, in the existing
  shape.

## Alternatives

* **A flow as its own graph, with its own tables.** Rejected: two graph models of one canvas would disagree within a
  week, and L1's already holds the spec's board table twice on purpose.
* **Asking the garment-lock question per board, as L1 does.** Rejected: that is the hole. A four-hop chain gets past
  three independent checks that each look at one board.
* **Charging a flow once per design version, as `credit_spend` does.** Rejected: one charge for fourteen boards means
  nothing to give back when one fails, and the spec says a failure refunds.
* **Keying the charge on the board alone.** Rejected: a retry after a refund would then be free, which is two model
  calls for one charge.
* **Flow packs as `templates` rows.** Rejected: `templates.snapshot` is a validated design. Following L8's own
  separate tables for kit bundles and tech packs costs one more table and breaks nothing.
* **A pack applied through the panel contract.** Rejected: `addBoard` returns no id, so fan-in could not be wired.
* **Downgrading an output that cannot be artwork to an asset.** Rejected: a print file that silently became an asset
  is a surprise in a factory file later. The board fails, says why, and gives the credits back. `roleWanted` says what
  a picture asked for *and* the refusal, so a caller cannot take the quieter answer and ignore the loud one.
* **A thumbnail image per pack.** Rejected: no third-party asset is committed, and a picture of a pack goes stale.
  The thumbnail is drawn from the pack's own shape, so it cannot.

## Consequences

* The two acceptance tests of F-L4 pass against stubs, and will pass against real adapters without a change here.
* A generated picture cannot become artwork through a chain of any length, and no later workstream can make it one by
  accident: both orders of the trick are refused by the database.
* `credit_spend_output` and `credit_refund_spend` are the shapes L3 and L5 need for their own failed generations.
  Neither replaces the existing credit functions.
* **The panels are built but not wired.** `components/launch/{Inspector,RailPanels,BoardCanvas}.tsx` draw labelled
  placeholders where a panel goes, and those files belong to L1; the orchestrator wires `board-info-card`, `flow-run`
  and the flow canvas into them, as the plan says it will (Lesson 9). Nothing in this workstream depends on when.
* The run summary is read back from `flow_runs`, so a reload shows the same panel, and **a board's row is written as
  that board finishes** rather than after the run: a pack takes minutes, and a row written at the end would mean the
  panel showed nothing while it ran and nothing at all if the action died with boards already charged. A run in
  flight is still not resumable — the server runs it to the end in one action, and a browser that goes away does not
  stop it — but what it did up to that point is on the record.
* Each board's row names the credit ledger line it charged, so a charge is never unaccounted for, and keeps the kind
  the board had when it ran, so a summary never has to guess it from a canvas read.
* Two reviews of this workstream, one of the migration and one of the TypeScript, found nineteen problems between
  them. Every one is fixed with a test. The two that mattered most were the second and third orders of the laundering
  trick above, and a capability rejection escaping the run engine, which would have left a board charged with no
  refund and no record.

## Dependencies

No new dependency. `fflate` (MIT) already in the lock file makes the zip, as the job packet and the production package
already use it. Everything else is what the app carries: React, Next.js, zod, Tailwind and `@supabase/supabase-js`,
each MIT or Apache-2.0.

## Owner questions

1. **What does a generated picture or a clip cost?** Every figure comes from the credit price for marketing media,
   which is a labelled placeholder nobody has priced. A clip has no per-second figure at all yet, so a clip is counted
   as one picture and the panel says so. The spec's own diagram shows "Run all ▶ 120 credits"; this platform shows
   what its prices say, which today is 3 for the Club kit pack.
2. **How do the asset counts of `07` split across the steps?** The counts are the spec's own and are held to by a
   test; the split is Knitwright's reading, and three packs needed one: the Brand drop pack's eight listing images,
   the Team store promo's six, and the Colourway set's six pictures. Every row says it is a draft nobody reviewed.
3. **Is a flow template a thing a platform admin edits?** It is rows, so it can be. There is no screen for it, and
   the seed is the only writer.
4. **Should a failed board stop the run, or only what it feeds?** Today a failure skips the boards it feeds and lets
   the rest finish, and nothing is charged for a skipped board. A club that wants all-or-nothing would want the other
   answer.
5. **Is a tutorial film going to be made?** Every pack has the spec's "Watch tutorial" card, and every card says no
   film exists rather than opening nothing.
6. **Does Launch need an entry in the studio top bar?** L6 adds no navigation, as 0091 asked. The flow templates
   panel and the run summary are reached inside the launch shell.

## R-GAP-000

No rulebook entry covers a flow, so every refusal, cost, field and row this workstream writes carries `R-GAP-000`.
The gaps are:

* what a run of a launch pack costs, and what a second of a clip costs;
* what a flow pack's steps are, and how its asset count splits across them;
* whether a picture that came through an AI board may ever be used as artwork (the platform's answer is no, in three
  places, and it is spec decision 13 rather than a rulebook entry);
* what an info card shows when the garment's own data is missing;
* whether a failed board stops a run.
