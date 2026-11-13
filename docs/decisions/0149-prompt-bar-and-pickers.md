# 0149: The prompt bar and the pickers: Agentic, Image, Video and Ask on the canvas, wired to the run engine

Status: Accepted (plan v6, workstream E5)
Index: Accepted; the prompt bar writes the AI boards' own settings and runs them through runFlowAction (cost first, ledger charge and refund, garment lock); + menu modals, font and colour pickers, Choose Artboard Size with Products, design version history; no migration
Index title: Prompt bar and pickers
Date: 2026-11-13
Plan step: v6 wave 3, E5. Builds on 0145 (one canvas), 0133 (flows run real capabilities), 0141 (AI Studio), 0132
(validation gates ordering), 0137 (design system). Spec: `08` §5.1, §5.6, §5.7 and the v3.2–v3.7 blocks; `09` screen 12;
prototype e02, e31–e34, e38–e40, e44.

## Context

The Kittl editor's bottom prompt bar is where a person asks for an AI image or clip, with mode, model, aspect and
count, a + menu (Browse Styles, Prompt builder, Prompts), and a toast when a generation fails. The canvas also needs a
font picker and a colour picker (Color / Brand), Choose Artboard Size with our Products tab, and a version history
panel. The capabilities already exist: the AI image and video boards and their settings (L3, L5), the run engine that
shows a cost, charges, refunds and checks the garment lock (0096, 0133), Ask (F-S5), the Creative Agent's routing
(0141), the licensed kit-font list and the brand kit (0079, Y6), the artboard presets (0091) and design versions with the
gate's statuses (0132). The bar must never make or fake an output of its own.

## Decision

1. **The prompt bar** (`components/prompt-bar/PromptBar.tsx`, logic in `lib/prompt-bar/`), mounted under the canvas in
   the launch shell with one line, opening upwards so the canvas keeps its size. Collapsed it reads "Describe image you
   want to create"; open it shows the reference row (the board a new one is fed from, numbered, 🔒), the prompt and the
   footer + · mode | model · aspect · count · ⋯ … wand · mic · send. It reads the selection from E1's canvas store.
2. **Image and Video write the boards' own settings and run them** (`plan.ts`): an AI board of the mode's kind that is
   selected is edited and rerun ("Edit AI image board"); otherwise a new `ai_image` / `ai_video` board is added right of
   the reference (the selection when the board accepts it, else the first garment board), connected and run. A video from
   a garment gets a free deterministic first-frame mockup in front, as AI Studio's video generator does. Frames to Video
   needs two selected pictures. Boards are added through `saveBoardAction` and `connectLaunchBoardsAction` and run through
   `runFlowAction` — so the cost is the run engine's own estimate (`estimate.ts`, shown on Send before anything is spent
   and checked again by the server), the charge goes through the credit ledger, a failed board is refunded, and the
   garment lock is the engine's. A canvas with no garment refuses in words.
3. **Choices are what the boards take.** Aspects are the AI image board's (1:1, 4:5, 9:16, 16:9, Match) and the video
   board's (9:16, 1:1, 16:9); counts 1–4; lengths 3–15 s; video models are L5's list with credits per second, exactly as
   `AiVideoPanel` reads it. The image board has no model setting, so one "Standard" card is shown. Kittl's other aspects,
   4K/Fast/Pro cards, Transparent background and voice input are not offered as working controls (shown disabled with
   the reason where the spec draws them). "Keep garment exact" is shown on and fixed.
4. **Ask Knitwright** goes to `askRulebookAction` and shows the answers above the bar; no credits. **Agentic (Beta)** uses
   the Creative Agent's routing: a question is answered by Ask in place, anything else opens `/ai-studio/agent` with the
   words (0141), which starts a design through the guided flow.
5. **The + menu:** Browse Styles (the shoots' five styles; Upload Style disabled, nothing keeps a brand's styles yet;
   Auto-apply Model on and fixed, one model), Prompt builder (six categories of Knitwright-written words, one pick per
   category, Surprise me, "Add to your prompt"), and Prompts (History = this canvas's AI boards' prompts; Presets = a short
   Knitwright image list and L5's video presets). The wand adds the chosen style's own light and camera words — no model.
6. **The toast** (`outcome.ts`) says what really happened: "Generation failed" with the board's reason and either "No
   credits were used" or "n credits were refunded", from `runFlowAction`'s `spent` / `refunded`; a run that never started
   (server refusal, no network) can only say no credits were used. Retry reruns the board. **Every paid capability the
   bar reaches has a refund path** (the flow meter); there is no capability without one.
7. **Pickers, exported for E3:** `ColourPicker` (Color | Brand, SV square, hue and alpha, eyedropper where the browser has
   one, HEX/RGB and %, Project colors; Brand from the brand kit via `brandTabColours`; on a garment panel, the sublimation
   estimate's own warning) and `FontPicker` (Fonts = the licensed kit-font list, Brand = the brand's role fonts; a font with
   no licence on file is listed and cannot be picked; filter chips only for tags the list carries; Upload font ♛ disabled).
8. **Choose Artboard Size** (`components/pickers/ArtboardSizeModal.tsx`): Popular, Products, Social, Marketing, Store and ♛
   Print on demand; Settings with W/H, unit, DPI, orientation, margin and Create. Presets are the `launch_artboard_presets`
   rows, grouped by a small key map until the rows carry a group. Products are the brand's designs; picking one adds a
   garment board at E1's `newBoardSize("garment")`. A custom size is checked against the canvas's bounds. Opened from
   **Add board** by the project name.
9. **Version history** (`components/pickers/VersionHistory.tsx`), from the clock by the project name: the design's
   `spec_versions` with `design_statuses`, newest first; the design is the selected garment's, else the canvas's own,
   else the first garment's. Show autosaves hides plain saves; an ordered version shows 🔒; Restore uses
   `restoreVersionAction`, which writes a new version and never changes an order. Two read actions serve the panels
   (`lib/pickers/actions.ts`); no write of their own.
10. `/dev/prompt-bar?show=` draws every state with made-up data for the 1440 × 900 comparisons; Send and Create there call
    the real actions, which refuse without a session.

## Consequences

- No migration, no new table, no new dependency. `lib/prompt-bar` and `lib/pickers` are held at 90%.
- The launch dock's old prompt input (L1) is still there until E2 replaces the dock.
- E2 may move `CanvasDoors` (Add board, version history) into the right panel's header unchanged.

## Owner questions (each with the default taken)

1. Fonts carry no categories and no KIT-SAFE claim yet. Who decides which fonts are kit-safe, and on what test? Default:
   the picker shows "All" only and no KIT-SAFE tag until the list carries them.
2. Artboard presets have no group column; Social/Marketing/Store come from a key map of the six seeded rows. Add a group
   column (a migration) so admins can group new presets? Default: map, new presets in Popular only.
3. Print on demand (kit print areas at production size) needs each base's print areas as preset rows. Source them from the
   base articles' print areas? Default: the tab shows its premium state and says nothing is listed yet.
4. Image models: should the platform offer more than one picture model (Kittl's 4K/Fast/Pro), each with its price?
   Default: one "Standard" card, the configured provider.
5. Version history treats every plain save as an "autosave". Should a person be able to name a version? Default: no names;
   statuses and restores are the milestones.
