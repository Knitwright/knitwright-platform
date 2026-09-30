# Intent core: what is owed by the owner

## Owner action A7: approve the golden set

`golden/tops.json` holds 207 instructions for tops, each with a PROPOSED outcome written by the
build agent. Every case has `"approved": false` and the file has `"status": "proposed"`. Nothing
in it is approved. To approve, the owner reads each case and either sets `approved` to `true` or
changes its expected outcome. When every case is approved, set `status` to `"approved"`.

Step 12's live accuracy target (90%) is measured against this set, so it only means something
once the owner has approved it.

The replies in `golden/replay-tops.synthetic.json` are written by hand, as an ideal model would
answer. They are NOT recorded from any model. They test the parser and the rules, not a model.
Step 12 records real replies in the same shape.

## Questions

Each line is a question, with what the code does today beside it.

1. **What counts as construction?** Today: every tops option except fit (neckline, collar, placket,
   sleeve type, sleeve length, hem shape, side panels, cuffs). A model may change fit from a loose
   request such as "make it roomier"; it must ask before changing anything else it was not told.
2. **Is the wearer guarded like the garment type?** Today: yes. "Make it for my son" becomes a
   question; "make it for kids" is applied.
3. **Which words name a choice outright?** Today: the list in `vocabulary.ts`. For example "jersey"
   and "rugby shirt" name a team jersey, "tee" alone names no type, "polo collar" names a collar
   and not a polo shirt. Please add or strike words.
4. **When a type does not offer a choice** ("long sleeves" on a crew neck tee) the design offers the
   other tops types that do, and "Keep it as a Crew neck tee". The first type is recommended. Should
   a different one be recommended, or none?
5. **When a model changes something not asked for**, the question offers "Yes, make the change"
   (recommended) and "No, only make the other changes" or "No, leave the design as it is". Should
   "No" be the recommended answer instead?
6. **Numbers.** A measurement or fabric weight is only accepted when the person typed that number,
   or the current value moved by a number they typed (in cm, mm or inches). "Make it a little
   longer" never becomes a number. Is that strict enough, or too strict?
7. **Colours.** A colour a model sets is free text such as "navy", with an optional screen swatch,
   marked as suggested by the assistant. Colour codes are never looked up. Is that right?
8. **What the assistant cannot do from a message yet:** artwork, logos and printed numbers,
   components, seam construction, size runs, adding or removing fabrics and colourways. Today the
   model is told to reply with a rejection for these. Which should come first?
9. **Repeating a choice.** When a model asks for a value the design already has, the change is
   skipped, so the person's own choice keeps its source. If nothing else changes, the reply says
   "The design already has that." Is that the right wording?

## Step 12 (text input): what is owed

- **A3, provider keys.** No live call has been made. Until `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`
  with `INTENT_MODEL` set to an OpenAI model) is set, the chat panel says the assistant is not
  switched on, and only short requests the rules can read work.
- **Model selection and the 90% live run** (plan step 12, tasks 2 and 6): owed. The harness is
  `scripts/eval-text.mts`; how to run it is in `docs/evals/README.md`. It needs A3 and, to mean
  anything, A7.
- **Prices** in `lib/providers/catalog.ts` were read on 2026-09-29 through a summarising tool. Check
  them. Claude Haiku 4.5 is due to retire no sooner than 2026-10-15.

## Step 12 questions

10. **Which words may the rules answer without a model?** Today: a message of at most 16 words made
    only of phrases in `vocabulary.ts` plus plain joining words ("make it", "please", "with", "and").
    "Make it roomier" becomes a relaxed fit with no model call. Is that too eager?
11. **Retry.** The stronger model is tried once when the first answer is a question or unreadable.
    Should a rejection be retried too? Today it is not.
12. **Cost per message.** A message that reaches a model reserves the most it can cost (about 1 US
    cent on Claude Haiku 4.5), and the retry reserves again. With today's provisional allowance of
    $0.25 a day, a person can send about 25 such messages a day. Is that the right order?
13. **Text that tries to change the rules** ("ignore previous instructions", "you are now ...") is
    refused before any model sees it. A message that merely mentions a rule in another sense, such as
    "follow the brand rules for labels", passes. Is the refusal wording right?
14. **A signed choice lasts one hour** and only while the design is at the same version. Long enough?

## Step 13 (sketch and photo input): what is owed

- **A8, golden images**: 40 tops pictures, none of a third-party brand, plus a few that are not
  garments. `golden/images/images.json` is empty on purpose; `golden/images/README.md` says how to
  add a case.
- **A7**: approve each image case's expected outcome.
- **A3**: the live run (80% right garment type, option accuracy beside it) needs a key:
  `scripts/eval-images.mts`, see `docs/evals/README.md`.

## Step 13 questions

15. **Numbers in a picture** (a sketch with "chest 52" written on it) are not used today, and the
    person is told. Should they be proposed as `read-from-image` values for the person to confirm?
16. **What must be confirmed?** Today: the garment type always, the wearer if it changed, and every
    construction choice the reading changed. Fit and colours are shown but not ticked. Enough?
17. **A picture that is not a garment** keeps its cost (the model read it). Should it be refunded?

## Bottoms, outerwear and close-fitting (steps 18, 21, 24)

### Owner action A7: approve three more golden sets

`golden/bottoms.json` (50 cases), `golden/outerwear.json` (51) and `golden/close-fitting.json` (51)
hold PROPOSED outcomes written by the build agent, every case `"approved": false`, each file
`"status": "proposed"`. Approve them as for tops. Their replies in `golden/replay-<family>.synthetic.json`
are written by hand and NOT recorded from any model.

### Owner action A8: supply and approve 45 images

`golden/images-<family>.json` holds 15 proposed image cases per family. Each says what the image
should show (`image.describes`); `image.file` is null because no image exists yet. For each case:
supply an image that matches, or change the description to fit one you have, check the proposed
outcome, and set `approved` to `true`. An "applied" outcome there is what the review screen should
propose; the person still confirms type and construction. They are wired to the step 13 image
replay when the branches are joined.

### Questions

1. **Which words name a choice outright?** See `words-bottoms.ts`, `words-outerwear.ts` and
   `words-close-fitting.ts`. Choices I made that need your eye:
   - "Hoodie" alone names no type (pullover or zip?), so "make it a hoodie" becomes a question.
   - "Sweatpants" and "jogging bottoms" name joggers; "trackies" and "tracksuit bottoms" name track
     pants; "tights" and "yoga pants" name leggings. Are those right in your market?
   - "Vest" and "tank top" name the vest, as in British English. In American English "vest" is a
     sleeveless jacket. Which do your customers mean?
   - "Base layer" names the compression top. "Bra top" and "crop bra" name the sports bra.
   - "Cuffs" and "pockets" alone name ribbed cuffs and side seam pockets.
2. **One phrase, several families.** "Remove the drawcord" names no drawcord on a hoodie and an
   elastic waistband on joggers; "long sleeves" names long sleeves on a top and on a compression top.
   The design's own family decides which applies. Is any phrase wrong in one family?
3. **Every option except fit is construction**, in every family, so the assistant asks before
   changing a waistband, a hood, a seam type or an underband it was not told to change. Should
   any of them (for example side stripe, which changes colour as well as sewing) be style instead?
