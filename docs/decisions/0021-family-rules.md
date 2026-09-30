# 0021: Construction rules, words and golden sets for bottoms, outerwear and close-fitting

Status: Accepted. The rules wait for a factory; the golden sets wait for the owner (A7, A8).
Date: 2026-09-30
Plan steps: 18 (bottoms), 21 (outerwear), 24 (close-fitting)

## Context

Tops have construction rules in the registry (step 8, decision 0010), words that name each
type and choice (step 11, decision 0013), and a golden set of 207 proposed utterances with
synthetic replies. The other families had registry entries, seams and components (decision
0016) and flats (decision 0017), but the intent core knew only the tops words, and the
ambiguity rules listed only the tops options.

## Decision

1. **Construction rules stay data in the registry, shown as proposals.** Each family gains
   the few rules general practice suggests were missing: a pocket bag seam on bottoms and
   on outerwear side pockets, cord ends on a drawcord, an underband casing on a covered
   sports bra underband, and a printed label on garments with flat seams. Every rule uses
   seam and stitch classes already in the catalogue, and none holds a quantity. Parts marked
   `proposal` are shown as "proposed by Knitwright". The ISO numbers of every class still
   need a factory check (see `lib/garment/OWNER-QUESTIONS.md`).
2. **Each family has its own word file** (`lib/intent/words-<family>.ts`), in the shape of
   the tops words. The same phrase may name a choice in several families ("ribbed cuffs" on
   a top and on joggers, "remove the drawcord" on a hoodie and on joggers). The matcher now
   keeps every target of a phrase, and the ambiguity rules only ask whether the choice a
   model made was named, so a phrase naming the same kind of choice in two families is safe.
3. **Fit is the only style option in every family.** Every other option of every family is
   construction (`OPTION_KINDS`), so a model must ask before changing it unless the person
   named the new choice. A test fails if a family adds an option not in the list.
4. **Words that only hint at a choice are left out on purpose.** "Hoodie" alone names no
   type, since it could be a pullover or a zip hoodie; "for running" or "for yoga" names no
   bottoms type. These become questions.
5. **Each family has a golden set of at least 50 proposed utterances** (`golden/<family>.json`)
   in the tops shape, every case `approved: false`, with hand-written synthetic replies
   (`golden/replay-<family>.synthetic.json`) and faulty replies. The replay is never silent on
   100% of each set and gets the proposed outcome on every case. These replies test the
   parser and the rules, not a model.
6. **Image cases are descriptors only.** Step 13's image pipeline lives on another branch, so
   each family has 15 proposed image cases (`golden/images-<family>.json`): what the image
   shows, the design it is read against, and the proposal the review screen should show.
   `file` is null and `approved` is false until the owner supplies the images (A8). They are
   wired to the image replay harness when the branches are joined.

## Consequences

- The model input for a design lists only its own family's types, choices and rules, as for
  tops, so the prompt does not grow with each family.
- The live accuracy targets of steps 12 and 13 mean something for these families only once
  the owner approves the sets.
- The guided e2e test for one type in each family is owed at integration (Docker was down
  while this was built).
