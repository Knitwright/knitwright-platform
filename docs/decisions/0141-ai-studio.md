# 0141: AI Studio — the workflows hub, the Creative Agent, workflow pages and the generators

Status: Accepted (plan v6, workstream P3)
Index: Accepted; /ai-studio is the workflows hub, every launch workflow of `09` has a page wired to what exists, three deterministic workflows added, paid ones honest when off, crest to kit and benchmarks moved with 308s
Index title: AI Studio
Date: 2026-11-13
Plan step: v6 wave 2, P3. Builds on decisions 0137 (tokens and components), 0138 (the shell and the route map) and
0133 (flows run real capabilities).

## Context

Build pack v3.9 copies Kittl's AI Studio: AI Workflows with a hero and an Ask Creative Agent box, a Creative Agent
page, a page per workflow (form on the left, Output example on the right, Generate n in the footer) and Image and
Video generator tabs (`09` screens 2–6 and the "AI workflows at launch" table; prototype d07–d12). U2 left six
placeholder routes. Most of the capabilities already exist — crest to kit, benchmarks, the launch canvas with its flow
templates, marketing layouts, shoots and AI video boards, the design chat and Ask — each behind its own screen.

## Decision

1. **One catalogue** (`lib/ai-studio/catalogue.ts`) lists every workflow of `09`'s table with its steps, output,
   cost, "Powered by" line, engine and provider gate. The hub, the cards and the pages all read it.
2. **The hub** (`/ai-studio`, and the same screen at `/ai-studio/workflows`): a grey hero with a faint grid
   (`studio-hero`), "What do you want to create today?" and the Ask Creative Agent card, then "Start a workflow" with
   the tabs Discover · For you · 2027 kits · Teamwear · Ads · UGC · Product scenes, Search workflows, rows with View
   all, and the Browse styles drawer (the shoots' own image styles; a tile opens the Image generator with it chosen,
   Auto-apply model adds a model preset). "For you" is the four workflows the spec names first, the same for every
   brand (owner question 1).
3. **Workflow pages** (`/ai-studio/workflow/[id]`, `components/ai-studio/WorkflowFrame.tsx`): "← AI Studio", a white
   card with the numbered form, a footer with the image count and **Generate n · cost**, disabled with its reason in a
   tooltip until the form is valid (`lib/ai-studio/answers.ts`; the server checks the same answers against the same
   form), and the Output example with "Powered by". A failed run shows the toast "Generation failed, no credits used".
4. **How each workflow runs** — nothing here calls a model:
   - **Crest to kit** and **Benchmark products**: the existing F-T2 and F-S2 screens inside the frame, one column
     (they draw their own answer beside their form), behaviour and test ids unchanged. `/crest-to-kit` and
     `/studio/benchmarks` answer **308** to the new pages (`MOVED_ROUTES` in `lib/shell/redirects.ts`); a
     comparison's own page stays at `/studio/benchmarks/[id]`.
   - **Canvas workflows** — Kit launch ad, Team store promo, Shopify listing set, Colourway set, Matchday graphic,
     New signing, Fixtures list, Sponsor thank-you, On-model try-on, Flat-lay studio, Try-on video, Resize for all
     socials, and the two generator tabs: Generate sets a **launch canvas** up from the answers (a Design board for
     the chosen design, then the boards that make the output, connected; `lib/ai-studio/canvas-plan.ts`) and opens
     it. The canvas runs each board through the run engine with its cost shown first and the garment lock checked
     (0133), so a workflow can only make what a person could make there by hand. Where a flow template is the
     workflow (`colourway-set`, `shopify-product-listing`) it is laid out by `applyFlowTemplate` itself. The Kit
     launch ad uses the campaign form's own layouts (`layoutsFor`), with the highlight written into each post; the
     team posts use the marketing layouts `matchday`, `new-signing`, `fixtures-list` and `sponsor-thank-you`.
   - **Retro kit remix** and **Change kit colour** (new, deterministic): four variants from the design's own
     parameters — the colourway and a kit pattern the base offers, through `kitStyleActions` — each passing the same
     checks as the editor's alternatives (structure kept, no repeat, no new blocker from the guardrails or the factory
     validation gate). They are drawn as flats; "Use this design" saves one as a new version. Never pixels on a panel.
     The era colour shifts (LCH) are a Knitwright reading, labelled as ours (owner question 2).
   - **Club brand board**: the crest is read by crest to kit's engine (`/api/crest-to-kit`, which keeps nothing), the
     colours are drawn as a board, and "Save to my brand" writes them as a palette through Brand Studio's action.
   - **Provider-gated**: On-model try-on, Flat-lay studio and the Image generator need `MEDIA_SHOOTS_LIVE` and a
     provider; Try-on video and the Video generator need `MEDIA_VIDEO_LIVE` and `FAL_KEY` — the switches the run
     engine reads (`liveKinds`). Remove background has no provider at all (`lib/panel-layers/background.ts`). When off,
     the page shows its form and example, says "Not available yet" and why, and Generate stays disabled; the action
     refuses too. No fake output.
5. **The Creative Agent** (`/ai-studio/agent`) is not a new model. A question goes to **Ask** (F-S5), whose answers
   only phrase rulebook entries with their "Why?" links; anything else starts a design in the guided flow
   (`startGuidedAction`), which sends the words to the design chat (`ChatPanel`). + starts from a sketch; History
   lists the conversations kept for the brand's designs (`assistant_messages`), one per design; New chat clears the
   page; the six quick-start tiles open their workflows (Tech pack opens Projects, as a tech pack needs a design).
   The microphone is shown and disabled with its reason: no voice input exists.
6. **Image and Video generators** (`/ai-studio/image`, `/ai-studio/video`): the workflow format under AI Studio's
   tabs; the reference is one of the brand's designs, garment-locked (🔒). Generate writes the same board settings the
   launch board panels (`AiImageBoardPanel`, `AiVideoPanel`) read and opens the canvas where they run. Credits come
   from `lib/credits` settings (`marketing_media` per image) and the video placeholder credits per second × length.
7. **States** (10 §9): skeletons for the agent and generators (`loading.tsx`; none under `workflow/[id]`, so an
   unknown workflow keeps its 404), empty states for no designs ("Create your first kit"), no search match, no
   history and no valid variant, inline field errors, the not-available state, and the app's error page.
8. `/dev/ai-studio` draws the hub, the agent, a workflow, a gated workflow and both generators with made-up data and
   no database, for the 1440 × 900 comparisons with d07–d12.

## Consequences

- No migration and no new table. No new dependency.
- The workflow forms are data (`lib/ai-studio/forms.ts`): a choice is a list the platform already keeps (concepts,
  poses, model presets, campaigns, destinations, video presets and models), so adding one to its own table adds it here.
- Kit launch ad's `09` cost is "Credits"; ours renders free (the marketing render is deterministic), and the page says
  Free. AI copy is not offered from the workflow page.
- Team store promo drops `09`'s Style step: the three layouts the store promo uses do not change with a style, and a
  step that changes nothing is not shown.

## Owner questions

1. "For you" is the same four workflows for every brand. Should it follow something (sport, segment, history)?
2. The era colour shifts of Retro kit remix are Knitwright's own reading of each decade. Keep, or give us references?
3. Should Generate on a canvas workflow also start the free boards' runs straight away, rather than opening the canvas
   for the person to press Run all?
