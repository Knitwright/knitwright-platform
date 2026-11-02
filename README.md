# Knitwright platform

The studio, club and brand workspaces, the tech pack and the factory files, the Launch content surface
and the ops console behind Knitwright's made-to-order teamwear. A person describes, uploads or
configures a design; the platform turns it into a factory-ready package with a source on every value;
and ops takes the order through a weekly batch to the factory, quality control, packing and shipping.

This repository is the platform only. The Store and Sell storefronts (cart, checkout, payment, team
stores, club sites) are separate. There are two doors between them: the database function
`submit_order_for_production` (`docs/decisions/0043-ops-console-batches.md`) and the read-only Store
contract (`docs/store-contract-v2.md`).

**The platform cannot place a real order today**, for six reasons, four of which are purchases or
decisions only the owner can make. They are set out at the top of
[`docs/owner/README.md`](docs/owner/README.md). That page is the first thing to read if you want to
know what state this is actually in.

## Start here

| If you are | Read |
|---|---|
| New to the code | [`docs/architecture.md`](docs/architecture.md): apps, code areas and the workstream that built each, data flow, the two panel contracts, stubbed providers, how the repository is worked on, CI |
| **The owner** | [`docs/owner/README.md`](docs/owner/README.md): what is blocked and why, then [`docs/owner/open-questions-v5.md`](docs/owner/open-questions-v5.md), the 252 open questions grouped by what kind of answer each needs |
| Building the Store | [`docs/store-contract-v2.md`](docs/store-contract-v2.md) |
| Running production | [`docs/runbook/ops.md`](docs/runbook/ops.md) |
| Setting up hosting | [`docs/runbooks/supabase-hosted.md`](docs/runbooks/supabase-hosted.md) |
| Preparing to launch | [`docs/launch-checklist.md`](docs/launch-checklist.md) |
| Looking for why something is built a way | [`docs/decisions/README.md`](docs/decisions/README.md), 107 records |
| About to open a pull request here | ["How this repository is worked on"](docs/architecture.md#how-this-repository-is-worked-on) — it is unusual, and the next person will otherwise get it wrong |

## Run it

Node 22.13 or newer (CI uses 24), pnpm 10, and a container runtime for local Supabase — Docker, or
Podman, which is what the agent sandboxes use.

```
pnpm install
cp supabase/.env.example supabase/.env     # the bot check needs TURNSTILE_SECRET_KEY, or every sign-in fails
pnpm db:start                              # starts local Supabase and writes apps/web/.env.local
pnpm dev                                   # http://localhost:3000
```

With Podman, start its socket and point Docker's client at it first:

```
systemctl --user start podman.socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock
```

`apps/web/.env.example` describes every environment variable. Without provider keys, paid features say
they are not available (see "Where providers are stubbed" in the architecture map). Set `OWNER_EMAIL`
by hand if you want the owner-only paths — the pattern bridge and the print-file library.

**If a database is already running, do not restart or reset it.** `pnpm db:start`, `pnpm db:reset` and
`pnpm db:env` are owner commands here: one local Supabase on fixed ports is shared by every session, and
a reset destroys everyone else's fixtures. To apply migrations that landed since it started, use
`supabase migration up --local --include-all` — `--include-all` because workstreams take assigned
timestamps in parallel, so a new migration is often older than the last one applied.

Before you push: `pnpm typecheck`, `pnpm lint`, `pnpm test:cov`, `pnpm build`. For a migration also
`pnpm --filter web test:db`. The browser tests are **not** part of the per-pull-request gate: pass the
`e2e` label when you open the pull request (`gh pr create --label e2e`) if your change is one they are
the only cover for.

## Layout

```
apps/web/        the Next.js app: app/, lib/, components/, e2e/, tests/, scripts/
supabase/        76 migrations and the local configuration (never edit supabase/config.toml)
docs/            decisions, owner documents, the spec, runbooks, launch records, reviews
plans/           the build plans (current: plans/platform-v5.md)
scripts/         repository checks, the decision index generator, local setup
Sportswear/      not platform work; never changed from here
kitwright/       not platform work; never changed from here
```

## Reviews

Reports from the review and hardening pass. Plan v4's (workstream W5):

- Security: [`docs/reviews/security-v4.md`](docs/reviews/security-v4.md)
- Code: [`docs/reviews/code-v4.md`](docs/reviews/code-v4.md)
- Coverage and journeys: [`docs/reviews/coverage-v4.md`](docs/reviews/coverage-v4.md)

Plan v5's are workstreams R1 to R3:

- Code: [`docs/reviews/code-v5.md`](docs/reviews/code-v5.md) (R2, decision 0112)
- Security and coverage land beside it as `security-v5.md` (R1) and `coverage-v5.md` (R3)

R4 is this documentation pass (decision 0115).

## Rules that apply everywhere

- **Nothing a factory reads is invented.** A default is labelled "Knitwright default", never shown as a
  measurement. Missing owner input never blocks: it leaves a labelled default and an owner question.
- **Manufacturable by construction.** Structural values only ever come from a base article's approved
  options and parameter ranges, so a panel cannot produce an invalid result
  (`apps/web/lib/editor/slots.ts`, `apps/web/lib/launch/panels.ts`).
- **Every rule explains itself.** Every finding, range, option and tech-pack field carries a `ruleId`
  that resolves to a rulebook entry. A check with no entry yet carries `R-GAP-000` and is listed.
- **AI never draws the garment.** AI output becomes parameters and layers, never pixels on a panel;
  generated imagery never reaches a panel layer or a print file, and tests prove it.
- **Only the server writes.** Every table has row level security and no browser write grant.
- **Words on screen come from `apps/web/lib/copy/vocabulary.ts`.** Text may say "reviewed by",
  "accepted by" or "signed by" with a name and a date. It may not say a thing is settled unless a
  person with a name said so.
- **Generated files carry no date or random id**, so the same input gives the same bytes.
- **Data, not constants.** Catalogue, prices, tiers, cut-offs, lead times, country rules and factory
  capabilities are rows or settings, never literals in code.
- Read [`apps/web/AGENTS.md`](apps/web/AGENTS.md) before changing a route or page: this is not the
  Next.js version older docs describe.
