# 0135: The inspiration board runs on its real ports in production

Status: Proposed. Built and unit-tested; not yet run against the hosted database. Owner questions below.
Index: Proposed; the board's actions and the suggestion checker pass live ports, and Pinterest is off by a setting
Index title: Inspiration ports wired
Date: 2026-11-12
Plan step: platform v6, wave 0, D4 (`plans/platform-v6.md`). Spec: F-S1 (`docs/spec/02-features.md`), product
direction decision 10 (`docs/spec/01-product-direction.md`). Builds on decision 0082 (the inspiration board), 0066 (the
base article catalogue), 0073 (moderation), 0079 (Brand Studio) and 0098 (the template library).

## Context

The v6 gap audit found that every server action of the inspiration board (`lib/inspiration/actions.ts`) called
`boardFor` without ports, so `UNWIRED_INSPIRATION_PORTS` applied in production. The Knitwright library row was always
empty, the context query never held the article's sport or the brand's mood words, and card screening passed every card
through. The suggestion checker (`designChecker` in `lib/inspiration/server.ts`) validated on `UNWIRED_PORTS`, so a
suggestion skipped the parameter-range and moderation checks that the design's own save runs. Pinterest was switched
off by a `pinterest: null` literal where the board is built.

## Decision

1. **`lib/inspiration/live-ports.ts` holds the four real ports.** They all read through the signed-in member's own
   client, so the database's rules decide what is seen.
   - **Articles:** the base article's `name` and `sport_tags`, read from the `base_articles` row the garment type maps
     to (`baseArticleForType`).
   - **Mood:** the brand's voice words from Brand Studio (`brand_profiles.voice_tags`: bold, gritty, community,
     premium, playful). These are the only fixed-vocabulary mood words the brand kit holds. The free-text style fields
     are left out because they are sentences, not tags.
   - **Library:** the design templates (`templates`, `kind = 'design'`). Each one is tagged with its sport, garment,
     style labels, colour family, and its sport, era and mood tags, and matched on those tags. Only the best eight are
     drawn, with the template library's own renderer (`previewOf`). The card opens the template library filtered to
     that template's sport, garment and style.
   - **Screen:** moderation's text screen (`screenTextContent`, decision 0073) runs over each card's title and creator
     name in the `label` context, and a card it would block is not shown. In that context a brand name only flags. The
     link-preview row exists to show brand and competitor products, so a brand name alone must not empty it. For the
     same reason the mark registry is not read: in this context a mark can only flag, and a flagged card is still
     shown.

   The article and mood ports say "nothing known" when their read fails, so a missing profile never takes the board
   down. The library port faults instead, and the board shows its usual fault sentence in that row.
2. **`boardFor`'s `ports` is required.** Every action passes `productionPorts(client)`, and the type system now refuses
   a caller that forgets. The unwired set stays for the unit tests.
3. **Suggestions are validated with the live validation ports** (`livePorts(adminClient())`, the same ports as the
   save in `lib/projects/service.ts`). A suggestion is now never held to less than the save that would store it.
4. **Pinterest is off by a setting.** `lib/inspiration/settings.ts` holds `DEFAULT_INSPIRATION_SETTINGS = { pinterest:
   "off" }`, labelled as a Knitwright default. The board asks the setting first, then the key and the flag
   (`PINTEREST_APP_ID`, `NEXT_PUBLIC_INSPIRATION_PINTEREST`), then the person's own login through a
   `PinterestAccessReader`. No sign-in exists yet, so production's reader is `NO_PINTEREST_LOGINS`. While the setting
   is off, the row says so in its own sentence and no login is looked up. The "Search on Pinterest" button is not
   affected.
5. **Tests.**
   - `live-ports.test.ts` covers each port over a stand-in client. It includes a test that `inspirationPorts` returns
     no unwired port.
   - `wiring.test.ts` drives the real server actions and asserts that `boardFor` receives live ports. It also asserts
     that the suggestion checker hands `specInput` the live validation ports.
   - `settings.test.ts` covers every branch of the Pinterest row.

No migration: every table read here already exists and is readable by `authenticated`.

## What is left

- **A library card cannot be saved to a moodboard.** Its picture is drawn on request as a `data:` address, and a
  moodboard keeps only `https` addresses, so the card carries a sentence that says so. A served preview route for
  templates would lift this.
- **"Suggest from this" reads nothing from a library card.** The vision reader only fetches `https` pictures. F-S1 says
  a library item "can become suggestions directly". Building that would take the template's own style and colours as
  the transferable elements, without a model, and it was not part of D4.
- **Past designs with permission and golden-sample photos** are not in the library row. There is no permission flag
  for past designs and no table of sample photos to read.

## Owner questions

1. **When do we build Pinterest sign-in?** This needs a Pinterest application of Knitwright's own, OAuth with token
   storage, and an application for Standard access (decision 0082, question 2). Until all three exist, the setting
   stays `off`. Turning it on without them would only show "sign in to Pinterest" with nowhere to sign in.
2. **Are the voice words the right mood words?** Brand Studio's five voice words are used as the mood words, and the
   template library's mood vocabulary (bold, clean, sharp, playful, understated) overlaps them only on "bold" and
   "playful". Should the brand kit carry the template vocabulary instead, or as well?
