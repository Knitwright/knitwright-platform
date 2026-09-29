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
