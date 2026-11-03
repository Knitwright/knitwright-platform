# 0128: An unscreened picture warns; it does not hold the factory door shut

Status: Accepted. The owner answered question 1 of decision 0116 (owner question E113): an unscreened picture
**warns** and names itself, and "Ready for the factory" still opens. `UNSCREENED_BLOCKS_HANDOFF` is `false`.
A picture the content review has **flagged or blocked** still blocks the hand-off, which is unchanged.
Index: Accepted; an unscreened picture warns and names itself rather than holding "Ready for the factory" shut
Index title: An unscreened picture warns; it does not hold the factory door shut
Date: 2026-11-03
Plan step: platform v5, review and hardening (`plans/platform-v5.md`), answering owner question E113
(`docs/owner/open-questions-v5.md`), raised as question 1 of decision 0116.

## Context

H3 of the v5 security review found that F-G2's "moderation status clear" was passing for content nobody had
ever looked at. `lib/validation/live-ports.ts` dropped a target with **no stored screening** out of the
answer, so `moderationClear` saw an empty list and raised nothing: a check that never ran reported as a pass.
Decision 0116 fixed the port — it says `pending` for such a target now — and left one question behind, because
fixing the port only moved the question: what does `pending` cost?

It was set to the strict answer on the way in (`UNSCREENED_BLOCKS_HANDOFF = true`), and the strict answer has
an edge that is not about security at all. **Only `POST /api/artwork` screens anything on the way in.** Every
other path that has ever put a picture in front of this platform — the older artwork path, a brand's uploads, a
size map, a pattern file — wrote no screening row, so on the day this ships *every brand's existing artwork
reads as unscreened*. A blocker would mean each of them re-adding its artwork through that one path before it
could hand anything to a factory, and a first order is exactly the wrong moment to teach somebody that.

The record put both answers in front of the owner because both are defensible and the difference is one line.

## Decision

**It warns.** `lib/validation/checks/moderation.ts`:

```ts
export const UNSCREENED_BLOCKS_HANDOFF = false;
```

Three things follow, and nothing else in the platform changes.

### 1. What a person sees

The readiness list shows, against the picture, by the label the design gives it:

> **Club crest has not been through the content review, so nobody has looked at it yet.**
> Upload it again to send it for review, or replace it. Nothing else is needed from you.

It is a warning, so the list still opens the hand-off. The fact is in front of the person rather than in the
way of their first order, which is the whole of what the owner chose.

### 2. What still blocks

**A verdict still blocks.** `flagged` and `blocked` are untouched and are blockers either way:

| What the review said | Severity | Why |
|---|---|---|
| nothing — no row at all (`pending`) | **warning** | nobody has looked; almost nothing ever has |
| `flagged` | blocker | a person at Knitwright is looking, and has not finished |
| `blocked` | blocker | a person said no, and a print would be a wrong nobody can undo |

This is what makes the softening safe to make: it softens **"nobody has looked"**, never **"somebody said
no"**. X8 exists to stop the second thing reaching a factory, and it still does.

### 3. The setting is one line, and the test holds both answers

`lib/validation/checks/modules.test.ts` reads the constant rather than asserting a severity twice:

```ts
expect(UNSCREENED_BLOCKS_HANDOFF).toBe(false);
expect(found?.severity).toBe(UNSCREENED_BLOCKS_HANDOFF ? "blocker" : "warning");
expect(moderationClear.run(design({ moderation: [status("flagged")] }), profile)[0]?.severity).toBe("blocker");
```

So flipping the constant back needs that one `toBe` and nothing else: the strict policy is a line away for as
long as it is worth having. The last line is the part that does not move.

## What this does not decide

**It does not decide that the screening gap is acceptable.** Owner question E114 is still open: three upload
paths screen nothing because there is nothing to screen (a size chart and a pattern DXF carry only a label, and
the factory's job-packet photo arrives on a token-authenticated route with no session to meter a vision call
against). This record only says what the readiness list does about a gap while that gap exists.

**It does not make the warning disappear once a brand has screened its artwork.** A brand that re-adds a
picture through `POST /api/artwork` gets a `clear` row and no finding at all, which is the path out.

## Consequences

- `docs/owner/open-questions-v5.md`: E113 is answered and out of the list, so **the list of what blocks a real
  order is back to six** and the count is 269.
- A production package can now be handed over with an unscreened picture in it. That is the decision, stated
  plainly: the warning is the record that nobody looked.
