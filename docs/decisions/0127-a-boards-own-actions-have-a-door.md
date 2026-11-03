# 0127: A board's own Flatten, Upscale and Reframe have a door

Status: Accepted. `BoardActions` is drawn in the inspector's board panel and `flowOperationAction` is
called through the launch shell. The allow-list in `tests/architecture/mounted.test.ts` now holds nothing
but permanent helpers: no `reported` seam and nothing `in-flight`.
Index: Accepted; the inspector's board panel draws Flatten, Upscale and Reframe, closing the last seam 0124 reported
Index title: A board's own Flatten, Upscale and Reframe have a door
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`), closing the seam decision 0124
reported. Spec: F-L4 (the launch shell's board task bar). Reads decisions 0096 (the flow canvas and its
contract), 0108 (the launch panels) and 0124.

## Context

Spec F-L4 puts three operations behind "more" on a board's task bar: Flatten, Upscale and Reframe.
Every piece of them was built. `lib/flows/operations.ts` decides what each one would do, what it
would cost and why it cannot be used; `flowOperationAction` saves the change and reruns the board so
the operation is charged, refunded and recorded like any other run; `components/flows/BoardActions.tsx`
draws all three with their costs and their reasons. `lib/flows/operations.test.ts` and
`edges.test.ts` cover the decisions in both directions.

**Nothing drew the component and nothing called the action.** The contextual task bar offers the three
and hands them to the board's own panel — `lib/launch/task-bar.ts`, and `LaunchShell`'s own comment
saying "Flatten, Upscale, Reframe … are the panels' own work" — and that panel was mounted nowhere. So
the bar offered three operations that led to a panel which did not exist.

Decision 0124 found it from both directions at once: a component reachable from no page, and an
exported server action called by nothing. It reported the seam rather than closing it, because the
three files it takes are L1's shell and #140 was open at the time, and it wrote the recipe into the
record so the next person would find the answer rather than the hole.

That recipe is what this is. The pull requests it waited on have merged, so the files have no owner in
flight.

## Decision

Three lines in three files, as 0124 named them.

1. **`components/launch/useLaunchShell.ts`** gains `runOperation(boardId, operation, options)` beside
   `runCanvas`, going through the same `send` helper, so a refusal arrives in the shell's own note.
   The board id is a **parameter** rather than read from the shell's state: the panel that draws these
   is showing one board, and it must not be able to act on another.
2. **`components/launch/Inspector.tsx`**'s `FlowRun` gains `graph` and `onOperation`, and `BoardPanel`
   draws `<BoardActions>` last, under the board's own panel, because it acts on the board the panel
   above describes. `graph` is on `FlowRun` rather than a prop of its own because it is what the three
   operations are decided from — a board's offers depend on what it is connected to, not on the board
   alone.
3. **`components/launch/LaunchShell.tsx`** passes both in the `flow` prop it already builds.

**The shell still makes no paid call.** `runOperation` carries the ask to L6's action, which does the
charging, the refund and the record, exactly as `runCanvas` does for the whole canvas.

## Proof

- `components/flows/board-actions.test.ts` — all three are offered and named; an operation that cannot
  be used stays on the screen with the reason beside it; and once the board has been run, the cost is
  on the screen before the button is pressed and the button is live. `STUB_COSTS` decides the figure,
  not the test.
- `e2e/launch-wiring.spec.ts` — the first time any of the three is drawn in a browser: the "This board"
  section with all three disabled on a fresh board, "Run this board first" as the reason, Upscale's own
  choice of how much bigger with 2× pressed, and an axe scan.

**Nothing is pressed in the end-to-end test.** A fresh board has not been run, so all three are refused
and the refusal is what is asserted. Pressing an operation that *is* allowed starts a real run, which is
a paid call and never a test's to make.

## Consequences

`tests/architecture/mounted.test.ts`'s last two `reported` entries — `BoardActions.tsx` and
`flowOperationAction` — are deleted. The allow-list is now **ten `helper` entries and nothing else**:
no `reported` seam, nothing `in-flight`. Every component, server action and API route in this
application either has a door a person can reach, or a permanent entry whose reason names the plan or
the flag that keeps it dark.

The test passing with those two entries gone is itself the proof that the pair is reachable: were
either still unreachable, the sweep would name it and the test would fail.

## What is still owed

`publishFlowListingAction` stays allow-listed with the Store reason written out. It builds the Store
hand-off's listing payload, and the Store is out of bounds for this plan — so it is a door that is
deliberately not ours to open, rather than a seam anybody forgot.
