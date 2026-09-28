# 0001: Stack

Status: Accepted
Date: 2026-09-27
Plan step: 1

## Context

The platform is built by one person with Claude Code, is open to public sign-up, and must
cost as little as possible to run without lowering quality. The owner's landing page is
already on Vercel. Source: `plans/knitwright-mvp-blueprint.md`, sections "Stack" and
"Cost plan".

## Decision

| Need | Choice |
|---|---|
| Web app | Next.js 16, React 19, TypeScript, Tailwind v4, Zod 4 |
| Hosting | Vercel. Free during the build, Pro from public launch. |
| Database, sign-in, files | Supabase, free tier to start |
| Text and vision model | Chosen by measurement in step 12, behind `TextModelProvider` |
| Image generation | Chosen by comparison in step 14, behind `ImageProvider` |
| Email | Resend, free tier |
| Bot check | Cloudflare Turnstile |
| Error monitoring | Sentry, free tier |
| PDF | `@react-pdf/renderer`, to be proven by the spike in step 7. Fallback: `pdfkit`. |
| Excel | `exceljs` |
| 3D preview | `three`, `@react-three/fiber`, `earcut` |
| Tests | vitest, fast-check, Playwright |
| Package manager | pnpm workspace, one app in `apps/web` |

Versions installed in step 1: Next.js 16.3.6, React 19.2.8, Zod 4.6, vitest 5.0,
Playwright 1.63, Node 24, pnpm 10.20.

## Evidence

Choices were made from vendor pages read on 2026-09-27. None had been tried in this
project when chosen. Each later step checks the libraries it names against their current
documentation before use, and records a new decision if one is replaced.

Proven so far, in step 1: the Next.js app builds, type-checks, lints, and passes unit and
end-to-end tests on Node 24 with pnpm 10.

## Alternatives

- Evolving the existing `kitwright/` proof of concept. The owner chose a fresh build.
- Self-hosting. Rejected for the build phase: managed free tiers cost nothing and need no
  upkeep.

## Consequences

- Code stays portable: no storage or queue product that exists on one host only.
- Supabase free projects pause after a week without activity.
- Vercel's Hobby plan is for non-commercial use, so the account moves to Pro before public
  launch (owner action A2).
- `exceljs` had its last release in October 2023. It works, but no fixes are expected.
