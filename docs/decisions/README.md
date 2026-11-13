# Decisions

One file per decision, numbered in the order they were made. A decision is never edited
after it is accepted. To change one, write a new file that supersedes it and update the
status line of the old one.

Copy `0000-template.md` to start.

## Index

The table is generated from the records by `scripts/write-decision-index.mjs`, so it is never
edited by hand: write your record, then run the script. Each record supplies its own row, and may
carry an `Index:` line (a shorter reading of its state than `Status:`) and an `Index title:` line
(where the index leaves out a workstream suffix). The record is the authority: open it for the
full line.
"Proposed" means built and waiting for the orchestrator or the owner to accept it. Nothing
here is superseded. Owner questions are collected in `docs/owner/questionnaire-2026-10-25.md`.

<!-- The table below is written by scripts/write-decision-index.mjs. Do not edit it by hand. -->

| No. | Decision | Status |
|---|---|---|
| 0001 | [Stack](0001-stack.md) | Accepted |
| 0002 | [Function time limit on the host](0002-function-time-limit.md) | Open: needs a deployment |
| 0003 | [Accounts, the sign-up switch and request wrappers](0003-accounts-and-request-wrappers.md) | Accepted |
| 0004 | [Brands, isolation and file storage](0004-brands-isolation-and-files.md) | Accepted |
| 0005 | [The garment contract and the registry for tops](0005-garment-contract.md) | Accepted; questions open for the owner |
| 0006 | [Size charts and how a measurement is worked out](0006-size-charts.md) | Accepted; no chart data yet, waits for the owner |
| 0007 | [Designs, versions and the editor](0007-designs-versions-editor.md) | Accepted |
| 0008 | [The PDF renderer](0008-pdf-renderer.md) | Accepted locally; deployed check owed |
| 0009 | [Flats: one geometry model, two renderers](0009-flats.md) | Accepted; drawings wait for the owner |
| 0010 | [The tech pack document](0010-tech-pack-document.md) | Accepted; construction rules wait for a factory |
| 0011 | [Exports: PDF, Excel and SVG](0011-exports.md) | Accepted locally; deployed check of 0008 owed |
| 0012 | [Usage metering and caps](0012-usage-metering.md) | Accepted; monthly allowances; amounts wait for the owner |
| 0013 | [The intent core](0013-intent-core.md) | Accepted; golden set waits for the owner |
| 0014 | [A 3D form made from the flat (trial)](0014-garment-3d-trial.md) | Trial; waits for the owner's verdict |
| 0015 | [A brand's own size chart, imported from a spreadsheet](0015-chart-import.md) | Accepted |
| 0016 | [Registry models for bottoms, outerwear and close-fitting](0016-family-models.md) | Accepted; questions open for the owner |
| 0017 | [Flats for bottoms, outerwear and close-fitting](0017-family-flats.md) | Accepted; drawings wait for the owner |
| 0018 | [Photoreal images as background jobs](0018-photoreal-images.md) | Accepted; provider provisional until the owner judges quality |
| 0019 | [Text input](0019-text-input.md) | Accepted; model choice and live evaluation wait for keys |
| 0020 | [Sketch and photo input](0020-image-input.md) | Accepted; golden images and live run owed |
| 0021 | [Construction rules, words and golden sets for the other families](0021-family-rules.md) | Accepted; rules wait for a factory |
| 0022 | [The guided flow](0022-guided-flow.md) | Accepted; five timed runs owed to the owner |
| 0023 | [Launch hardening: deletion, monitoring, legal pages](0023-launch-hardening.md) | Accepted; legal review and Sentry DSN open |
| 0024 | [The lead engine: buyer kind, organisation details, quote requests, leads page](0024-lead-engine.md) | Accepted; mail notice waits for the owner |
| 0025 | [Consent to marketing email, unsubscribe links and logo rights](0025-consent-and-logo-rights.md) | Accepted; legal text is a draft |
| 0026 | [Share links with comments and votes](0026-share-links.md) | Accepted; questions open for the owner |
| 0027 | [Beta scope, and player names and numbers](0027-beta-scope-and-names-numbers.md) | Accepted; launch garments and 3D verdict asked of the owner |
| 0028 | [The production contract](0028-production-contract.md) | Proposed |
| 0029 | [The pattern library](0029-pattern-library.md) | Proposed |
| 0030 | [Fabrics, Australian sizes and the cut list](0030-fabrics-sizes-cut-list.md) | Proposed |
| 0031 | [Print files for any design](0031-print-files.md) | Proposed; phases A and B built |
| 0032 | [Team orders, frozen releases and strike-offs](0032-orders-releases-proofs.md) | Proposed |
| 0033 | [Tech pack v2 and "Ready for the factory"](0033-tech-pack-v2.md) | Proposed; phases A and B built |
| 0034 | [One coordinate system for the 3D preview and the pattern pieces](0034-3d-pattern-coordinates.md) | Proposed |
| 0035 | [One artwork layer model for any design](0035-artwork-layer-model.md) | Accepted |
| 0036 | [Artwork intake: the club's own files, never storing an SVG](0036-artwork-intake.md) | Accepted |
| 0037 | [Pattern generators: many looks, one interface](0037-pattern-generators.md) | Accepted |
| 0038 | [Design from the user's image](0038-design-from-image.md) | Proposed |
| 0039 | [The validation gate and design status](0039-validation-gate.md) | Proposed |
| 0040 | [Sports catalogue: football, cricket and one Australian winter code](0040-teamwear-catalogue.md) | Proposed; questions open for the owner |
| 0041 | [The template library](0041-template-library.md) | Proposed; owner questions listed |
| 0042 | [Club workspace](0042-club-workspace.md) | Accepted |
| 0043 | [Ops console, part 1: orders in production, weekly batches, factory sheet and status](0043-ops-console-batches.md) | Accepted locally; database and browser tests first ran in CI |
| 0044 | [Credits ledger](0044-credits-ledger.md) | Accepted; numbers are placeholders |
| 0045 | [Editor guardrails as pure functions](0045-editor-guardrails.md) | Proposed |
| 0046 | [Intake test set and evaluation harness](0046-intake-evaluation.md) | Accepted; test set waits for the owner, no live run yet |
| 0047 | [Inspiration variants](0047-inspiration-variants.md) | Proposed |
| 0048 | [Chat edits as design diffs](0048-chat-design-diffs.md) | Accepted; owner questions listed |
| 0049 | [glTF base models whose UV layout is the print panel layout](0049-gltf-base-model-pipeline.md) | Proposed; no artist model exists |
| 0050 | [Ops console, part 2: quality control, packing, shipping, exceptions and metrics](0050-ops-console-qc-packing-shipping.md) | Accepted locally; database and browser tests first ran in CI |
| 0051 | [Credits wired into outputs](0051-credits-gates.md) | Proposed; charging is off by default |
| 0052 | [Football and cricket starter templates](0052-teamwear-templates.md) | Proposed |
| 0053 | [Per-panel layers in a Fabric.js editor: decision, data model and spike](0053-panel-layer-editor.md) | Proposed; waits for the owner (question 20) |
| 0054 | [Media sets, studio renders and watermark](0054-media-sets.md) | Proposed; owner questions listed |
| 0055 | [Generated-image checker](0055-generated-image-checker.md) | Proposed; thresholds are untuned defaults |
| 0056 | [Platform settings console](0056-platform-settings-console.md) | Proposed |
| 0057 | [Lifestyle images with scene replacement and virtual try-on](0057-lifestyle-images.md) | Proposed; owner questions listed |
| 0058 | [Turntable recording and image-to-video clip](0058-turntable-and-clip.md) | Proposed |
| 0059 | [The Studio media screen](0059-studio-media-screen.md) | Proposed; owner questions listed |
| 0060 | [Pattern service request](0060-pattern-service.md) | Proposed |
| 0061 | [Designer templates and the royalty ledger](0061-designer-templates-royalty-ledger.md) | Proposed |
| 0062 | [Brand workspace, product list and brand runs](0062-brand-runs.md) | Proposed; owner questions listed |
| 0063 | [Design comments](0063-design-comments.md) | Proposed; owner questions listed |
| 0064 | [Phone layout and accessibility pass](0064-phone-layout-accessibility.md) | Proposed |
| 0065 | [Two-click reorder with sizes pre-filled](0065-two-click-reorder.md) | Proposed |
| 0066 | [The base article catalogue](0066-base-article-catalogue.md) | Proposed; owner questions listed |
| 0067 | [Rulebook and "Why?" v1](0067-rulebook-and-why.md) | Proposed; owner questions listed |
| 0068 | [The graded parametric drafter](0068-graded-parametric-drafter.md) | Proposed; owner questions listed |
| 0069 | [Design object v2, validation on every save, and a rule behind every check](0069-design-object-v2-and-validation.md) | Proposed; owner questions listed |
| 0070 | [The production package (KPP) and the files-service seam](0070-production-package-and-files-service.md) | Proposed; owner questions listed |
| 0071 | [The factory model as data](0071-factory-model-as-data.md) | Proposed; every seeded price, tier and lead time is a placeholder, owner questions listed |
| 0072 | [Factory job packet (a link, no account)](0072-factory-job-packet.md) | Proposed; owner questions listed |
| 0073 | [Moderation and IP basics](0073-moderation-and-ip.md) | Proposed; owner questions listed |
| 0074 | [The studio home, the create-new modal and the catalogue](0074-studio-home-and-catalogue.md) | Proposed; every catalogue price is a labelled placeholder, owner questions listed |
| 0075 | [The editor shell and the Form toolbar](0075-editor-shell-and-form-toolbar.md) | Proposed; owner questions listed |
| 0076 | [The 2D pattern view and the Library toolbar](0076-view-2d-and-library-toolbar.md) | Proposed; owner questions listed |
| 0077 | [The Specs toolbar and the tech pack view](0077-specs-toolbar-and-techpack-view.md) | Proposed; owner questions listed |
| 0078 | [The tech pack PDF as sixteen pages, the Excel file as eleven sheets, and the Export panel](0078-techpack-pdf-pages-and-export-panel.md) | Proposed; owner questions listed |
| 0079 | [Brand Studio, typed by hand](0079-brand-studio-manual.md) | Proposed; club_kits read through not migrated, only the bundled Geist faces are licensed, owner questions listed |
| 0080 | [Make — product created, samples, golden samples and the order modal (Y7)](0080-make-samples-golden-samples.md) | Proposed |
| 0081 | [Names & numbers, the repeat maker, and Share](0081-names-numbers-repeat-maker-share.md) | Proposed; the font list is a labelled placeholder, owner questions listed |
| 0082 | [The inspiration board](0082-inspiration-board.md) | Proposed; owner questions listed |
| 0083 | [Ask and best practice over the rulebook](0083-ask-and-best-practice.md) | Proposed; owner questions listed |
| 0084 | [Benchmarks — compare products without copying one](0084-benchmarks.md) | Proposed; every fetch allowance and closeness threshold is a labelled draft, two R-GAP-000 rules, owner questions listed |
| 0085 | [The collection plan and the line plan](0085-collection-and-line-plan.md) | Proposed; every freight figure and the duty basis are labelled placeholders, owner questions listed |
| 0086 | [The teamwear configurator](0086-teamwear-configurator.md) | Proposed |
| 0087 | [Committee link v2 and roster sign-up](0087-committee-link-and-roster-signup.md) | Proposed; every number behind both links is a labelled default, owner questions listed |
| 0089 | [Compliance and pre-export unification](0089-compliance-and-pre-export.md) | Proposed; the label wording and the AQL plan are seeded as labelled defaults, no care symbol or CPSIA certificate exists, so every label is refused, owner questions listed |
| 0090 | [The remaining base article data (onboarding waves 2 and 3)](0090-remaining-base-article-data.md) | Proposed; every point-of-measure table is deliberately empty, owner questions listed |
| 0091 | [The launch shell and its boards](0091-launch-shell-and-boards.md) | Proposed; every artboard preset and credit figure is a labelled placeholder, owner questions listed |
| 0092 | [The mockup studio, deterministic and live-linked (L2)](0092-mockup-studio.md) | Proposed; every scene, backdrop, crop size and turned view is a labelled placeholder, owner questions listed |
| 0093 | [AI scenes and shoots](0093-ai-scenes-and-shoots.md) | Proposed; no model preset has a licence on file so none can be used, every credit figure is a labelled placeholder, owner questions listed |
| 0094 | [The marketing studio (L4)](0094-marketing-studio.md) | Proposed; CMYK is refused because no colour profile may be committed, every slot figure and character limit is a labelled placeholder, owner questions listed |
| 0095 | [The video studio](0095-video-studio.md) | Proposed; the encoder is the browser recorder until a deploy target with ffmpeg exists, every credit figure and every model row is a labelled placeholder, owner questions listed |
| 0096 | [Flows, the launch pack on one canvas (L6)](0096-flows.md) | Proposed; every credit figure is a labelled placeholder, every flow pack is a labelled default nobody has reviewed, owner questions listed |
| 0098 | [The template library to the launch counts of `07`](0098-template-library.md) | Proposed; four of the spec's football styles deliberately not seeded, three R-GAP-000 entries, owner questions listed |
| 0099 | [The map from the registry's option keys to the catalogue's option codes](0099-option-code-map.md) | Proposed; every mapped row quotes a published source, six rows deliberately unmapped, owner questions listed |
| 0100 | [Ops completion: the scheduled cut, the AQL table, ΔE at QC, the commercial invoice, couriers, status emails and the factory scorecard](0100-ops-completion.md) | Proposed; the AQL figures are seeded with no source cited, owner questions listed |
| 0101 | [What one garment consumes, per bill-of-materials line](0101-bom-consumption.md) | Proposed; one article's five figures seeded, each quoted and labelled a Knitwright draft no factory has agreed, seven of eight articles deliberately hold nothing and are still refused, owner questions listed |
| 0102 | [Brand import from a URL](0102-brand-import-from-url.md) | Proposed; nothing third-party is stored and a test proves it, only the bundled Geist faces can be matched, the screen is not wired because L7 owns no component path, four R-GAP-000 rules, owner questions listed |
| 0103 | [The studio top bar: one account menu, an overflow menu, and room to grow](0103-studio-top-bar.md) | Superseded by 0138; was proposed; the bar's sections go from 625 px to 389 px and the account cluster from three controls to one, Teamwear, Launch and Benchmarks get the entry each workstream was waiting for, Collect deliberately gets none and is reached from the club page instead, the inline-link contrast pattern swept and five pages scanned for the first time, owner questions listed |
| 0104 | [Australia and Translate: the AUD ladder, the GST trigger as data, Australia's label rules, the Australian starters, and the tech pack in Urdu](0104-australia-and-translate.md) | Proposed; the AUD prices, the care line and the Urdu review are named gaps, not figures |
| 0105 | [Crest to kit, and the quote PDF](0105-crest-to-kit-and-quote.md) | Proposed; no Pantone data ships so no Pantone match is claimed, no delivery date can be shown, every kit's socks are unpriced, three template families deliberately not offered, owner questions listed |
| 0106 | [The Store contract v2: read endpoints, a documented payload and explicit gaps](0106-store-contract-v2.md) | Proposed; five read endpoints behind a signed service token, a 247-field document locked to the shape by a |
| 0108 | [The launch panels no workstream owned](0108-launch-panels-unowned.md) | Proposed; Templates, Uploads and Brand built, Likes an honest placeholder because nothing records a like, L7's import screen wired, three R-GAP-000 entries, owner questions listed |
| 0109 | [Security review of plan v5](0109-security-review-v5.md) | Proposed; v5 reviewed — the garment lock is enforced on topology but not on provenance, two moderation hook points were never wired, five guard gaps fixed, owner questions listed |
| 0110 | [The three journeys of plan v5, and what coverage really covers](0110-journeys-and-coverage-v5.md) | Proposed; the three v5 journeys written as browser tests with their stops asserted; the production package never reaches the F-G2 gate so the care label is unreachable; four more walls found; `components` and 6,600 lines of `lib` seams outside the coverage figure; 44 of 62 specs run no axe scan; owner questions listed |
| 0112 | [The v5 code review](0112-code-review-v5.md) | Proposed; code review of all thirty v5 workstreams, four guards closed, 21 duplicate implementations and 96 unwired seams recorded, owner questions listed |
| 0115 | [The documentation after plan v5](0115-documentation-after-v5.md) | Proposed; the owner guide leads with what blocks a real order, and the 252 owner questions are collected into one grouped list |
| 0116 | [The four HIGH findings of the v5 security review](0116-security-v5-high-findings.md) | Proposed; H1 the garment lock's provenance moved to `public.files`, H2 the credit key digested, H3 moderation wired to every generation and order path with an unscreened target warning (owner answer, 0128), H4 a viewer may not spend credits; two owner questions open |
| 0117 | [Wave 2's editor panels, mounted](0117-wave-2-editor-wiring.md) | Accepted; all seven editor slots mounted, two panels left out with reasons |
| 0120 | [One length for one full turn of a turntable](0120-turntable-length.md) | Proposed; the turntable is six seconds everywhere, read from one constant, and decision 0058's eight is superseded |
| 0121 | [A founder's own point of measure and callout are part of the design](0121-marks-are-part-of-the-design.md) | Proposed; the Specs toolbar's marks are stored on the design, so a reload no longer loses them, and decision 0077 item 12 is superseded |
| 0122 | [The F-G2 gate speaks for the production package](0122-the-gate-speaks-for-the-package.md) | Accepted; the package route reads `designObjectFacts` and runs the F-G2 gate before drafting, so the care-label refusal of decision 0089 is reachable |
| 0123 | [Wave 4 wired: the panels mounted, the 3D view answering, and L2's run loop closed](0123-wave-4-wiring.md) | Proposed; L4's five rail panels, L4's marketing board, L5's AI video board, L6's info card, run summary and canvas are mounted and scanned by axe for the first time, L2's mockup board now draws a real file through L1's one writer, both 3D views answer the camera so the flip and the kit reveal can be recorded, the carousel waits on a second colourway reaching the viewer, five panels still hold their placeholders, owner questions listed |
| 0124 | [Every panel has a door, and a test that says so](0124-every-panel-has-a-door.md) | Proposed; the design-import, artwork, pattern-look and launch-pack panels mounted (artwork on Brand Studio, not in the editor, because two rights consents in one panel is worse than none), three deletes and the size-map undo given doors, `components/home/StartWays.tsx` deleted as superseded, and a three-way sweep (components, server actions, API routes) added as an architecture test with a reasoned allow-list |
| 0125 | [The clear space around a name is the rule's figure, not ours](0125-the-safe-zone-is-the-rules-figure.md) | Accepted; the safe zone is R-SUB-004's 15 mm, labelled as the rule's figure rather than a Knitwright default |
| 0126 | [The best-practice card has a door, and it is a part chooser](0126-the-best-practice-card-has-a-door.md) | Accepted; F-S5 v2's best-practice card is reached from a six-part chooser under the Specs toolbar, and 0117's toggle stays upright |
| 0127 | [A board's own Flatten, Upscale and Reframe have a door](0127-a-boards-own-actions-have-a-door.md) | Accepted; the inspector's board panel draws Flatten, Upscale and Reframe, closing the last seam 0124 reported |
| 0128 | [An unscreened picture warns; it does not hold the factory door shut](0128-an-unscreened-picture-warns.md) | Accepted; an unscreened picture warns and names itself rather than holding "Ready for the factory" shut |
| 0129 | [The rulebook has a sign-off session, and it will not credit a review nobody did](0129-the-rulebook-has-a-sign-off-session.md) | Accepted; one name, one role and one press confirms the rules Knitwright owns, and the sixteen that defer to a factory, a supplier or a lawyer are offered unticked |
| 0130 | [The rulebook's first sign-off names a title, because no person was given](0130-the-rulebooks-first-sign-off.md) | Accepted; the 29 rules Knitwright owns are signed off as "The pattern master" with no person named, and the 16 that defer stay drafts |
| 0131 | [Build pack v3.9 and the Store comes in](0131-build-pack-v39-and-the-store-comes-in.md) | Accepted; the v2.2 UI is replaced by the Kittl shell of build pack v3.9, and checkout, team stores, storefronts, channels and payouts are built here; supersedes v5 owner decision 1 |
| 0132 | [Validation gates ordering](0132-validation-gates-ordering.md) | Accepted; every order path and the order function refuse a version whose checks hold a blocker, and mark it ordered |
| 0133 | [Flows run real capabilities](0133-flows-run-real-capabilities.md) | Accepted; mockups and marketing posts are drawn for real in a flow, AI scenes and clips go through L3's and L5's runs behind their switches, and no task-bar button only selects |
| 0134 | [The 3D texture is the print file](0134-the-3d-texture-is-the-print-file.md) | Accepted; the editor's 3D view and the export preview paint each UV island with the art of that panel's print file, made on the server |
| 0135 | [Inspiration ports wired](0135-inspiration-ports-wired.md) | Proposed; the board's actions and the suggestion checker pass live ports, and Pinterest is off by a setting |
| 0136 | [Privacy and deploy housekeeping](0136-privacy-and-deploy-housekeeping.md) | Accepted; the erasure sweep reads name columns, rosters older than two seasons are purged by a daily cron, and `pnpm --filter web seed:templates` seeds the whole library |
| 0137 | [The v3.9 design system and component library](0137-the-v39-design-system-and-component-library.md) | Accepted; light tokens from `10`, Inter, lucide-react, the component library in components/ui, /dev/ui, and one compatibility block for the v2.2 names |
| 0138 | [The dashboard shell and the route map](0138-the-dashboard-shell-and-the-route-map.md) | Accepted; the 96 px rail, the 76 px top bar and the help bubble replace decision 0103's glass top bar, runs move to /orders/runs and /brand goes to Brand Studio, ten placeholder routes, every v2.2 page keeps a door |
| 0139 | [The Projects page](0139-the-projects-page.md) | Accepted; /projects with Recent (the old studio home, /studio 308s to it), Projects, AI Creations, Folders, Shared and Trash; folders and the Trash kept beside the two project tables |
| 0140 | [The Templates, Mockups and Marketing pages](0140-templates-mockups-and-marketing-pages.md) | Accepted; /templates rebuilt as Discover rows and tabs, /mockups and /marketing built over the existing library, one launch-start action opens a canvas from any of them, Trending row owed |
| 0141 | [AI Studio](0141-ai-studio.md) | Accepted; /ai-studio is the workflows hub, every launch workflow of `09` has a page wired to what exists, three deterministic workflows added, paid ones honest when off, crest to kit and benchmarks moved with 308s |
| 0142 | [The Products area](0142-the-products-area.md) | Accepted; /products replaces /catalogue, /catalogue/[code] and /brands/fabrics (308), Design this opens a configurator that makes the design on that base with its options, nothing priced or dated that no row holds |
| 0144 | [Team, Brand, Settings and the plans modal](0144-team-brand-settings-and-the-plans-modal.md) | Accepted; /club and /collect become /team (Roster · Approvals · Seasons, with the roster-retention opt-in), /brand-studio becomes /brand (empty and filled Kittl layouts), /settings gets its cards and a stored garment unit, and Upgrade and every ♛ gate open Choose Your Plan from placeholder plan rows |
| 0145 | [One infinite canvas](0145-one-infinite-canvas.md) | Accepted; /project/<id> for every design and launch canvas (/studio/<id> and /launch/<id> 308 to it); infinite plane with pan, zoom, culling and marquee; the canvas store E2–E5 read; garment, tech_pack and order kinds; a home canvas per design |

<!-- End of the generated table. -->
