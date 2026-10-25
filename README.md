# Knitwright platform

The studio, club and brand workspaces, tech pack and factory files, and the ops console behind Knitwright's made-to-order
teamwear. A person describes or uploads a design, the platform turns it into a factory-ready file with a source on every value,
and ops takes the order through a weekly batch to the factory, quality control, packing and shipping.

This repository is the platform only. The Store and Sell storefronts (cart, checkout, payment, team stores, club sites) are
separate. The one door between them is a database function, `submit_order_for_production`
(`docs/decisions/0043-ops-console-batches.md`).

## Start here

| If you are | Read |
|---|---|
| New to the code | [`docs/architecture.md`](docs/architecture.md): apps, code areas, data flow, stubbed providers, CI |
| The owner | [`docs/owner/settings-console-guide.md`](docs/owner/settings-console-guide.md) and [`docs/owner/questionnaire-2026-10-25.md`](docs/owner/questionnaire-2026-10-25.md) |
| Running production | [`docs/runbook/ops.md`](docs/runbook/ops.md) |
| Setting up hosting | [`docs/runbooks/supabase-hosted.md`](docs/runbooks/supabase-hosted.md) |
| Preparing to launch | [`docs/launch-checklist.md`](docs/launch-checklist.md) |
| Looking for why something is built a way | [`docs/decisions/README.md`](docs/decisions/README.md), 65 records |

## Run it

Node 20.12 or newer, pnpm 10 and Docker.

```
pnpm install
cp supabase/.env.example supabase/.env
pnpm db:start
pnpm dev
```

`pnpm db:start` starts local Supabase and writes `apps/web/.env.local`. The app is then at http://localhost:3000. Every
environment variable is described in `apps/web/.env.example`. Without provider keys, paid features say they are not available
(see "Where providers are stubbed" in the architecture map).

Before you push: `pnpm typecheck`, `pnpm lint`, `pnpm test:cov`, `pnpm build`. For a migration also `pnpm --filter web test:db`,
for a new route `pnpm e2e`.

## Layout

```
apps/web/        the Next.js app: app/, lib/, components/, e2e/, tests/
supabase/        migrations and local configuration
docs/            decisions, owner documents, runbooks, launch records, reviews
plans/           the build plans (current: plans/platform-v4.md)
scripts/         repository checks and local setup
```

## Reviews

Reports from the review and hardening pass (workstream W5):

- Security: [`docs/reviews/security-v4.md`](docs/reviews/security-v4.md)
- Code: [`docs/reviews/code-v4.md`](docs/reviews/code-v4.md)
- Coverage and journeys: [`docs/reviews/coverage-v4.md`](docs/reviews/coverage-v4.md)

## Rules that apply everywhere

- Nothing a factory reads is invented. A default is labelled "Knitwright default", never shown as a measurement.
- Only the server writes. Every table has row level security and no browser write grant.
- Words on screen come from `apps/web/lib/copy/vocabulary.ts`. Text may say "reviewed by", "accepted by" or "signed by"
  with a name and a date. It may not say a thing is settled unless a person with a name said so.
- Generated files carry no date or random id.
- Read `apps/web/AGENTS.md` before changing a route or page: this is not the Next.js version older docs describe.
