# Decisions

One file per decision, numbered in the order they were made. A decision is never edited
after it is accepted. To change one, write a new file that supersedes it and update the
status line of the old one.

Copy `0000-template.md` to start.

## Index

The status column is a short reading of each record's own `Status:` line, checked
against the files on 2026-10-25. The record is the authority: open it for the full line.
"Proposed" means built and waiting for the orchestrator or the owner to accept it. Nothing
here is superseded. Owner questions are collected in `docs/owner/questionnaire-2026-10-25.md`.

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
| 0068 | [The graded parametric drafter](0068-graded-parametric-drafter.md) | Proposed; owner questions listed |
| 0070 | [The production package (KPP) and the files-service seam](0070-production-package-and-files-service.md) | Proposed; owner questions listed |
