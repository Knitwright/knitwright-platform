# 0133: Flows run real capabilities

Status: Accepted. Every flow run is handed the production registry; the launch shell's board runs and
task-bar buttons each do their own action.
Index: Accepted; mockups and marketing posts are drawn for real in a flow, AI scenes and clips go through L3's and L5's runs behind their switches, and no task-bar button only selects
Index title: Flows run real capabilities
Date: 2026-11-12
Plan step: platform v6, workstream D2 (`plans/platform-v6.md`). Spec: F-L4 (and F-L1 to F-L3 for the
capabilities). Reads decisions 0092 (mockups), 0093 (AI scenes and shoots), 0094 (marketing), 0095
(video), 0096 (flows), 0123 (wave-4 wiring) and 0127.

## Context

The v6 gap audit found that `lib/flows/capabilities.ts` held an empty registry and `runFlowForBrand` was
never handed another. Every board of every run -- the free deterministic renders too -- went to
`stubCapability`, whose file ids are made up, so `set_launch_board_output` refused them and the board
failed with "could not be saved". The launch shell wired only the mockup's own Run; an AI image or
video board said "The panel that runs it is not built yet", and Remove background, Remix and Generate
video only selected the board.

## Decision

1. **A real registry, required.** `lib/flows/real/registry.ts` registers a capability for every kind a
   flow runs, and `FlowRunDeps.registry` is no longer optional, so no caller can fall back to the stub.
   `real/server.ts` builds the ports per run (member's client for reads, admin client for writes,
   the usage meter, X8's generation screen).
   - **Mockup**: L2's `renderMockupBoard`, unchanged, with its write caught and handed to the flow
     engine's recorder. Free, deterministic.
   - **Marketing**: L4's `layoutSvg` and `renderBytes`, as a PNG at the board's size (capped at
     4096 px, a Knitwright figure). Only inputs the platform drew are placed; a generated input is not
     even read. No watermark on a working picture; the export panel keeps the watermark rule.
   - **AI image**: L3's `runShoot` with `chooseShootProvider`, so the stub provider stands in unless
     `MEDIA_SHOOTS_LIVE` is "true" and a provider is configured. The garment reference is drawn from
     the design version (`lib/media/lifestyle/reference.ts`). The brand's credits are the flow meter's
     (one charge, one refund); the platform's spend is reserved and released by the shoot itself.
   - **AI video**: L5's `runAiVideo` with `chooseBoardVideoProvider`. The first frame is the render,
     never the AI scene that feeds the board. See item 4.
   - **Info card**: refused in words; nothing draws facts into a picture yet.
2. **The packs' scene names are mapped once** (`real/scenes.ts`). The six packs say
   `scene: "render-front"`; the library says `product-front` and the renderer reads `sceneSlug`. A test
   holds every pack's scene to a real library scene of the right source.
3. **The run panel's note says which kinds are live**, read from the adapters' own switches.
4. **AI clips are refused before any model is asked.** Decision 0095 samples a clip's frames in the
   browser (no decoder on the deploy target) and no table keeps a clip as a brand's file; a flow runs
   on the server. Calling a paid model for a clip that could only be thrown away would be money spent
   on nothing, so `video.ts` refuses while its `sample` or `store` port is missing, and its test proves
   the run works when both exist.
5. **Board runs and buttons.** `useLaunchShell` sends every non-mockup run, and every "run
   downstream", to `runFlowAction` with the flow's own estimate, and shows the first unfinished board's
   reason in the shell's note. Task-bar steps live in `lib/flows/task-actions.ts`: Remix reruns the
   generated picture with a new attempt (`remixFlowBoardAction`, a `remix` count the scene's seed is
   made from); Generate video adds an AI video board fed by the picture, where the model and cost are
   chosen before anything is spent; Flatten and Upscale run; Reframe opens the board panel with its
   shapes; Download opens `/api/files/<id>`. **Remove background is not offered**: no provider stands
   behind it (`lib/panel-layers/background.ts` holds only a refusing stand-in).

## Consequences

- The Club kit pack now makes 13 of its 14 assets for real; the turntable is refused with a sentence
  pointing to the 3D view's recorder. The acceptance test runs the pack through the real registry.
- No migration. No paid call from any test: each adapter's own stub provider is used.

## Owner questions

1. AI clips in a flow need either a server-side video decoder (a bundled ffmpeg, which 0095 declined)
   or a two-step browser round trip (server makes the clip, browser samples, server checks and keeps
   it), plus a table that keeps a clip as a brand's file. Which?
2. Remove background needs a provider (Photoroom is already an adapter family for scenes). Should it be
   wired, and at what credit price?
3. Should a board's working picture on a free plan carry the watermark, or only the export?
