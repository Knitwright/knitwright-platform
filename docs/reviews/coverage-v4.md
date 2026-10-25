# Coverage and journeys, v4 (W5-C)

Measured with `pnpm exec vitest run --project unit --project pdf --coverage` (the database project needs Docker and is not part of the figure).

## Overall

| | Before | After | Threshold |
|---|---|---|---|
| Statements | 96.40% | 96.54% | 80% |
| Branches | 91.42% | 91.58% | 80% |
| Functions | 96.69% | 96.86% | 80% |
| Lines | 97.16% | 97.27% | 80% |

No file was excluded and no threshold was changed.

## Lines covered, by directory under `lib/`

| Directory | Before | After |
|---|---|---|
| `lib/artwork-intake` | 99.7% | 99.7% |
| `lib/artwork-stack` | 100.0% | 100.0% |
| `lib/auth` | 47.3% | 47.3% |
| `lib/brand-runs` | 100.0% | 100.0% |
| `lib/brands` | 59.5% | 59.5% |
| `lib/charts` | 91.0% | 91.0% |
| `lib/clubs` | 98.6% | 98.6% |
| `lib/comments` | 100.0% | 100.0% |
| `lib/config` | 95.0% | 95.0% |
| `lib/consent` | 97.4% | 97.4% |
| `lib/copy` | 100.0% | 100.0% |
| `lib/credits` | 86.0% | 86.0% |
| `lib/credits-gate` | 100.0% | 100.0% |
| `lib/cutting` | 99.1% | 99.1% |
| `lib/deletion` | 100.0% | 100.0% |
| `lib/design-diff` | 98.8% | 98.8% |
| `lib/design-import` | 99.6% | 99.6% |
| `lib/designers` | 100.0% | 100.0% |
| `lib/fabrics` | 100.0% | 100.0% |
| `lib/flat` | 99.8% | 99.8% |
| `lib/forms` | 100.0% | 100.0% |
| `lib/garment` | 100.0% | 100.0% |
| `lib/garment3d` | 98.3% | 98.3% |
| `lib/gltf` | 100.0% | 100.0% |
| `lib/guardrails` | 100.0% | 100.0% |
| `lib/guided` | 100.0% | 100.0% |
| `lib/home` | 51.5% | 51.5% |
| `lib/images` | 75.0% | 75.0% |
| `lib/intent` | 99.2% | 99.2% |
| `lib/kit-styles` | 100.0% | 100.0% |
| `lib/leads` | 99.0% | 99.0% |
| `lib/legal` | 100.0% | 100.0% |
| `lib/media` | 99.5% | 99.5% |
| `lib/media-check` | 99.4% | 99.4% |
| `lib/monitoring` | 87.8% | 87.8% |
| `lib/navigation` | 100.0% | 100.0% |
| `lib/ops` | 99.0% | 99.0% |
| `lib/orders` | 99.0% | 99.0% |
| `lib/pagination` | 100.0% | 100.0% |
| `lib/panel-layers` | 97.6% | 97.6% |
| `lib/pattern-generators` | 98.8% | 98.8% |
| `lib/pattern-library` | 99.6% | 99.6% |
| `lib/pattern-service` | 100.0% | 100.0% |
| `lib/patterns` | 82.5% | 82.5% |
| `lib/print` | 99.5% | 99.5% |
| `lib/production` | 100.0% | 100.0% |
| `lib/profile` | 100.0% | 100.0% |
| `lib/projects` | 88.0% | 88.9% |
| `lib/proofs` | 100.0% | 100.0% |
| `lib/providers` | 99.1% | 99.1% |
| `lib/releases` | 100.0% | 100.0% |
| `lib/server` | 97.6% | 97.6% |
| `lib/settings` | 100.0% | 100.0% |
| `lib/share` | 82.2% | 82.2% |
| `lib/sizing` | 99.8% | 99.8% |
| `lib/storage` | 90.0% | 94.4% |
| `lib/supabase` | 14.3% | 14.3% |
| `lib/techpack` | 99.5% | 99.5% |
| `lib/templates` | 100.0% | 100.0% |
| `lib/units` | 100.0% | 100.0% |
| `lib/usage` | 97.9% | 97.9% |
| `lib/validation` | 100.0% | 100.0% |
| `lib/variants` | 100.0% | 100.0% |
| `lib/workspace` | 100.0% | 100.0% |

## Gap tests added

- `lib/projects/artwork-files.test.ts`: the brand-ownership check on artwork pictures (was 12% of lines).
- `lib/storage/links.test.ts`: `createDownloadLink` (invalid id, other brand, record fault, signed link, storage fault).

## Journeys added (`apps/web/e2e/journeys.spec.ts`)

1. **Club kit manager:** starter template to version 1, season roster from CSV, release and order to ops, cut into a batch, received through the ops screen, inspected, packed and shipped. Order status is asserted in `ops_orders` at submitted, batched, received and ready.
2. **Brand:** product to sample to run; both orders are asserted in `ops_orders` (status submitted) and `brand_runs`, not only on the page.
3. **Designer:** becomes a designer, offers a design with a rights statement, a platform admin accepts it, and the template exists in `templates`.

They use stand-in providers and no live model. Freezing a release and the Store's order submission use the server key, as in the existing specs, because they need the print file builder and the Store. The author had no Docker, so these specs were written against the existing specs' helpers and labels and run for the first time in CI.

## Known gaps

The files below are at or near 0% in the unit run. They join the app to the database and are covered by `tests/integration` and the end-to-end specs, not by unit tests:

- `lib/projects/service.ts`, `project-reads.ts`, `tech-pack-load.ts`
- `lib/home/load.ts`, `lib/auth/service.ts`, `lib/images/service.ts`, `lib/charts/service.ts`
- `lib/share/service.ts`, `lib/patterns/service.ts`, `lib/brands/service.ts`, `lib/credits/server.ts`, `lib/supabase/*`

Branch coverage is weakest in `lib/intent/explain.ts`, `lib/intent/follow-ups.ts` and `lib/charts/mapping.ts`. The per-directory 90% thresholds in `vitest.config.mts` all hold.
