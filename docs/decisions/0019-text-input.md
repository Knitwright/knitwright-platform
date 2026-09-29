# 0019: Text input

Status: Accepted. The model choice and the live evaluation wait for provider keys (A3) and the
approved golden set (A7).
Date: 2026-09-29
Plan step: 12

## Context

Step 11 turns a model's reply into one of three outcomes. Step 12 calls a model, from a chat panel
in the editor, under the allowances of step 10. No provider key exists yet (owner action A3), so no
live call can be made: everything is built against stub providers, and the choice of model is owed.

## Decision

1. **`TextModelProvider`** (`lib/providers/text-model.ts`) is the one interface. Two vendors are
   implemented with `fetch`, no SDK: Anthropic (Messages API) and OpenAI (Chat Completions). Both
   offer one tool, `reply`, whose schema is generated from the step 11 reply contract; the tool's
   input is written back as JSON text and parsed by `resolveIntent` like any other reply. The
   request shape was read from platform.claude.com on 2026-09-29. Claude Sonnet 5.5 refuses a forced
   tool choice, so it gets `tool_choice: auto` and the instructions ask for the tool.
2. **Candidates and prices** are in `lib/providers/catalog.ts`, cheapest first (gpt-5-nano,
   gpt-5.4-nano, gpt-5-mini, gpt-5.4-mini, claude-haiku-4-5, claude-sonnet-5-5). Defaults until the
   selection run: `claude-haiku-4-5` first, `claude-sonnet-5-5` for the retry (`INTENT_MODEL`,
   `INTENT_RETRY_MODEL`). Keys are optional in `env.ts`; without the chosen model's key the panel
   says the assistant is not switched on.
3. **Order of work** (`lib/intent/text-flow.ts`): a guard against text that tries to change the
   instructions (rejection, no model), then the rules (`rules.ts`: a short message made only of
   phrases that name a choice outright, joined by plain words, becomes a reply without a model),
   then the configured model, then **one retry on the stronger model when the first answer is a
   question or unreadable**. If the stronger model also asks, the question is shown.
4. **Cost.** A message the guard or the rules answer costs nothing (`cost` may now return null).
   Any other is priced at the most it can use: an input bound of 5,000 tokens (a test holds every
   tops type under it with the longest message) and a fixed output limit of 1,024 tokens. The retry
   is reserved separately, before it runs, and refused quietly if an allowance is used up.
5. **`defineRoute` change.** The handler receives `usage`: `refund()` (once, never throws) and
   `reserve(cost)` for a further call. A streamed answer is returned before the work ends, so the
   wrapper's refund-on-throw cannot cover it; the handler refunds itself when the first model call
   fails. Refunds stay "on a failed call only" as in 0012.
6. **Streaming.** `POST /api/projects/[projectId]/intent` answers with JSON lines: progress stages,
   then exactly one outcome or failure (`X-Accel-Buffering: no`, `no-store`). The model's own text is
   never streamed: it is untrusted until parsed, and a half-read JSON reply means nothing to a person.
7. **Saving.** An applied outcome is saved by the route through `saveTrustedActions`: all changes in
   one version (one undo takes them back), each marked `ai-suggested`, with the note
   "By the assistant: ...". The version the person was looking at is checked; if the design moved
   on, nothing is saved and they are told.
8. **Questions.** Each choice that changes something is sent as a **signed proposal**: an HMAC over
   the design, brand, person, version, the exact changes and their sources, valid for one hour, with
   a key derived from the server secret. `applyProposalAction` verifies it and saves it the same way.
   The browser can pick a choice but cannot change what it does or claim a source. No table is added.
9. **Chat panel** (`components/studio/ChatPanel.tsx`, logic in `lib/projects/chat.ts`): messages,
   progress, questions as buttons with the recommended one marked, reasons in plain words. It is
   disabled while the editor is saving.
10. **Evaluation harness** (`lib/intent/golden/live-eval.ts`, `scripts/eval-text.mts`): runs the
    golden set the way the product does, scores it, prices it from reported tokens, records the
    replies for replay in CI, and picks the cheapest model that reaches 90%. Not yet run.

## Evidence

- Unit tests with stub providers: rules, guard, retry order, refunds, streaming, signed proposals,
  both vendors' request and answer shapes (with a fake `fetch`), the route option.
- Text that tries to override the instructions is rejected even when the stub model would obey it.
- Where the rules answer a golden case, the outcome matches the proposed golden outcome (test).
- Database test: a batch is one version, all or nothing, refused at an old version.
- **No live model call has been made.** Accuracy, latency and real cost are unknown.

## Alternatives

- **Store proposals in a table.** Lost: a migration and clean-up for data that lives a minute.
- **Stream the model's tokens to the browser.** Lost: they are unparsed and untrusted (M2).
- **Reserve the retry with the first call.** Lost: it doubles every reservation for a retry most
  requests never need.
- **Vendor SDKs.** Lost: two dependencies for one POST each.

## Consequences

- The route answers in one stream of at most two model calls of 25 s each (decision 0002).
- A signed proposal can be replayed by the same person within the hour only at the same version,
  where it has the same effect.
- Claude Haiku 4.5 is due to retire no sooner than 2026-10-15; check before choosing it.
- When the live run exists, record it in `docs/evals/` and revisit the defaults.
