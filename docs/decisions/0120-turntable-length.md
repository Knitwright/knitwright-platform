# 0120: One length for one full turn of a turntable

Status: Proposed. The turntable is six seconds everywhere, the figure the spec gives; decision 0058's eight seconds is superseded and the owner is asked to confirm.
Index: Proposed; the turntable is six seconds everywhere, read from one constant, and decision 0058's eight is superseded
Index title: One length for one full turn of a turntable
Date: 2026-11-02
Plan step: platform v5, review and hardening (`plans/platform-v5.md`, "R1–R4"), closing item D-21 of
`docs/reviews/code-v5.md` (decision 0112).

## Context

A 360° turntable of a garment is made on two paths, and the two disagreed on how long one full turn takes.

- **The media set's turntable** is recorded in the browser from the 3D canvas with `MediaRecorder`
  (decision 0058, `components/media/video/record.ts`). `lib/media/video/limits.ts` held
  `TURNTABLE_SECONDS = 8`, and both `components/media/video/TurntableControl.tsx` and
  `components/media/screen/useMediaScreen.ts` passed it as the recording length AND as the length of one
  revolution.
- **The launch video's turntable** is a deterministic sequence (`lib/media/video/sequences.ts`), whose
  `turntable` row carried `seconds: 6` and one shot of 6 s, noted "Length from the spec's Video studio
  (F-L3) and video templates (07)".

So the same turn was 8 seconds or 6 seconds depending on which screen a person made it from. Both numbers were
written on purpose and each was traceable: `docs/decisions/0058-turntable-and-clip.md` says "8 seconds, one
full turn, 2.5 Mbit/s", and `docs/spec/02-features.md` F-L3 says "360° turntable (6 s)" while
`docs/spec/07-template-library.md` lists "360° kit turntable | 6 s". Decision 0095 open question 4 already
recorded the disagreement and said "one of the two should probably change". Nothing had changed it, and only
the 6 was held by a test, so the 8 could have drifted further without anyone noticing.

The code review of plan v5 found both numbers in the code and listed it as item D-21.

## Decision

**One full turn takes six seconds, wherever a turntable is made.** The figure comes from the spec, which is
what the platform is built to; a decision record is the weaker source when the two disagree and nobody has
measured either.

1. `lib/media/video/limits.ts`'s `TURNTABLE_SECONDS` is **6**, and its comment says where the figure comes
   from and that decision 0058's 8 is superseded by this record.
2. `lib/media/video/sequences.ts` **reads that constant** for the turntable sequence's length and for its one
   shot, instead of writing 6 twice of its own. The two paths cannot drift apart again.
3. `lib/media/video/sequences.test.ts` asserts the constant is 6 and that the sequence and its shot both read
   it. That test fails on the old code, where the constant was 8.

Nothing else changed. In particular:

- **The byte cap stays.** `MAX_TURNTABLE_BYTES` is 8 MiB, chosen in decision 0058 for 8 seconds at
  2.5 Mbit/s. A shorter clip is smaller, so the cap has more headroom than before and no screen's refusal
  changes.
- **The configurator's spin is not a turntable and is left alone.** `lib/teamwear/stage.ts` turns a kit over
  **twelve** seconds for a person to look at, under a constant of the same name. Decision 0086 calls that
  framing rather than a measurement, and it is not a video anyone downloads. The clash of names is noted in
  both files so the next reader does not take one for the other.
- **The still frames are not a length.** `lib/mockups/views.ts`'s `TURNTABLE_STEPS = 8` is eight frames of a
  turn, not eight seconds, and is unrelated. It is easy to misread as the same 8, so it is named here.
- `lib/flows/templates/club-kit.ts` already asks for a six-second turntable, which now agrees with every other
  path. It is a template's own data row with its own wording and was not rewritten to read the constant.

## Alternatives

- **Pick decision 0058's eight seconds and change the spec.** Rejected. Two spec documents say six and one
  decision says eight; the spec is what the product is measured against, and F-L3's four lengths (6, 4, 8, 9)
  are a set that a person sees side by side in the video studio.
- **Keep both, and let each path have its own length.** Rejected: that is what the code did, and it means a
  club's kit turns at one speed in its media set and another in its launch video with no reason a person could
  be told.
- **Leave it and raise it only as an owner question.** Rejected: decision 0095 did exactly that four days ago
  and the two numbers stayed. A question with no change behind it does not get answered faster.
- **Make the configurator's twelve seconds read the same constant.** Rejected: it is a different thing — how
  long a kit takes to turn while someone watches it, not how long a recorded turn lasts — and shortening it
  would change a screen nobody asked about in this review.

## Consequences

- A recorded turntable is now 6 s rather than 8 s, which is a **visible change to a feature that already
  works**: a media set recorded after this is two seconds shorter than one recorded before it. No stored row
  holds a length, so nothing already recorded changes or needs migrating.
- The browser recording has no test of its own (there is no `limits.test.ts` and no browser test asserts the
  length), so the new test guards the constant and the sequence, not the recorder's own behaviour. That gap is
  older than this change and is not closed here.
- **Owner question: is six seconds right for the recorded turntable?** Decision 0058 chose eight and its own
  open question asked whether "8 seconds / 8 MiB" was the right turntable. The spec's six is now in the code
  on both paths; if the owner prefers eight, the one constant moves and the spec's two documents need the same
  edit.
