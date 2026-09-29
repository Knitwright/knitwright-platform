# 0018: Photoreal images as background jobs

Status: Accepted. The provider is provisional until the owner judges quality (A3).
Date: 2026-09-29
Plan step: 14

## Context

Photoreal images take several seconds a view and cost money. No handler may rely on more
than 60 seconds (decision record 0002). The cost must come from the photoreal allowance
(decision record 0012), and a failure must give it back. `defineRoute` refunds only when
the handler throws, but the images are made after the handler has answered.

## Decision

1. **One reservation for a front and a back.** The route reserves $0.14 (two images at
   about $0.07) from the photoreal allowance through `defineRoute`'s `cost`. One request
   makes one usage record.
2. **The handler is told which reservation paid** (`usage.eventId`, a small change to
   `defineRoute`). Work carried on with `after()` refunds that reservation itself when it
   fails. A failure before the work starts (no provider, no drawing) throws, and the route
   refunds as before.
3. **Table `jobs`**: status queued, running, succeeded or failed; members read their brand's
   rows; only the server writes. The browser polls `GET .../images/[jobId]` every 2 seconds.
   A job unfinished after 3 minutes is given up by the poll, and its cost given back
   (a refund happens once at most, so two polls cannot refund twice).
4. **Both views are made at once, and stored only when both exist**, then the job is
   marked done. Moves between states are conditional, so a job given up as stale is never
   marked done later.
5. **The reference is the flat, drawn on the server with the uploaded logo's own pixels.**
   The model sees the real logo. It is not pasted onto the result (owner question 4).
6. **Generated pictures are shown as illustrations.** They are stored in the `images`
   bucket as `render` files, shown on the design page and in a separate section after the
   tech pack, each with a label saying they are not the specification. They are shown as
   data addresses made on the server, like the flats.
7. **Provider behind an interface.** `ImageProvider` with a Gemini implementation over plain
   HTTPS and stubs for tests. No key means the feature is shown as unavailable.

## Evidence

`tests/integration/images.test.ts`: with the stub, two stored images and one usage record
that keeps its cost; with a failing provider, the job fails with a safe sentence, the cost
is refunded and the earlier images remain; a stale job is given up and refunded once; the
photoreal allowance refuses a second parallel request; another brand sees no job or image.
The isolation suite covers `jobs`. Unit tests cover the prompt, the reference rendering
(the logo's pixels reach the PNG), the job runner, the panel's states and the Gemini
request and answer. Provider terms: `docs/data-processing.md`.

## Alternatives

- **Settle the cost inside the request** (wait for both images): risks the 60 second limit.
- **A queue service**: no queue exists and one is not needed at this volume.
- **Paste the logo onto the result**: needs the model to keep the flat's framing exactly;
  a misplaced logo is worse than a softened one. Left to the owner.
- **Signed storage links in the browser**: would need `img-src` for the storage host once
  step 26 adds a full content security policy.

## Consequences

- If the server stops mid-job, the cost stays reserved until someone polls the job after
  3 minutes. A job nobody polls again keeps its cost. Revisit with a scheduled sweep if
  this is seen.
- A picture stored just before a later failure can be left without a job. It is in the
  brand's folder and counts against nothing.
- Revisit when the owner chooses the provider, or when a job queue exists.
