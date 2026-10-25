# 0064: Phone layout and accessibility pass

Status: Proposed
Date: 2026-10-25
Plan step: plans/platform-v4.md, workstream W4-E

## Context

Kit managers use the Studio on phones. The redesign left a phone layout pass and an accessibility audit of the key screens
as its last item. This pass changes layout, spacing, labels and focus handling only: no behaviour and no data.

## Decision

1. **A phone spec.** `e2e/mobile.spec.ts` signs in at 390 by 844 and visits studio home, a design in the editor, its factory
   file, templates, the club workspace, credits and (as a platform admin) the ops console. Each page must have no sideways
   scroll, no button, field or link smaller than 40 by 40 px (a link inside running text is exempt), and no axe-core problem
   of impact serious or critical. A failure lists every problem on the page, not the first.
2. **A keyboard spec.** `e2e/accessibility.spec.ts` opens the design assistant on a phone, where it is a dialog, and checks
   that Tab and Shift+Tab stay inside it, Escape closes it, and focus returns to the Assistant button.
3. **Dialogs.** The only dialog in the Studio is the assistant sheet. It had Escape and returned focus, but Tab walked on into
   the page behind it. `lib/workspace/focus-trap.ts` (pure, unit tested) decides where Tab goes and `AssistantDock` uses it;
   the sheet now says `aria-modal`. The phone menu is a disclosure, not a dialog, and already closes on Escape and returns focus.
4. **Dependency.** `@axe-core/playwright` 4.13.0 (published 2026-08-11, more than two weeks old) was already a dev dependency
   from the earlier accessibility checks; no new package. Its licence is MPL-2.0, not MIT as the plan assumed: it is used in
   tests only and is not shipped. `pnpm audit --prod --audit-level high` result: see the PR comment.

## Fixed

- Assistant sheet: Tab is held inside, `aria-modal` set, Close and Hide buttons raised to 40 px.
- Studio header: logo, brand, credits and Settings links, the section pills and Sign out are 40 px tall; on a phone the
  header gaps are tighter so the taller links still fit in 390 px with no sideways scroll.
- Ops console: navigation links 40 px; the "Change" link has enough contrast; metric notes sit in a `dd`, so the
  definition list is valid.
- Factory file: Back link, journey steps, download buttons and the "things left" link 40 px; wide tables that scroll
  sideways are keyboard reachable regions with a name.
- Editor: choice rows (radios) and the Delete design link are 40 px tall.
- Every file picker under apps/web (artwork upload, logo or picture, image review, chart import, pattern request, and the
  ones already done) is `min-h-10`; so are the other design-page controls that could be shorter than 40 px: tool rail and
  assistant dock buttons, measurement helpers, history buttons and summaries, comment buttons and fields, variant and
  chart-mapping controls, tech-pack summaries and the kit "remove" button.

## Left

- Whatever the phone spec still reports after these fixes is listed in the PR comment; nothing is skipped or disabled.
- The 5 s timeouts (garment3d, rate-limits, charts/container) and the 240 s print case2 timeout are runner flakes, re-run rather than edited.
- Code splitting of the editor (see below) is a follow-up, not a presentational change.

## First-load JavaScript per route

Measured from `next build` (Turbopack, `.next/diagnostics/route-bundle-stats.json`) on 2026-10-25. Uncompressed and gzip (level 6),
in KiB, for the chunks a first visit loads. The three heaviest are flagged.

| Route | Uncompressed | Gzip | |
|---|---|---|---|
| /studio/[projectId] | 966 | 291 | heaviest 1 |
| /studio/[projectId]/tech-pack | 835 | 252 | heaviest 2 |
| /studio/[projectId]/guide | 827 | 251 | heaviest 3 |
| /studio/new, /studio/start | 743 | 221 | |
| /studio/[projectId]/layers | 722 | 215 | |
| /club | 499 | 151 | |
| /sign-up | 486 | 148 | |
| /brand | 485 | 148 | |
| /designer, /designer/new, /s/[token], /studio/charts, /sign-in, /brands/fabrics, /forgot-password, /brands | 479 to 481 | 146 to 147 | |
| /settings, /welcome, /studio/[projectId]/delete, /admin/leads, /studio/[projectId]/kit-styles, /studio/[projectId]/pattern-service, /templates | 473 to 477 | 144 to 145 | |
| /credits, /studio, /reset-password, /unsubscribe, /auth/confirm, /admin/templates | 470 to 472 | 142 to 143 | |
| every /ops route, /admin/settings, /, /legal/[document] | 459 to 472 | 138 to 142 | |

Shared by every route: about 459 KiB uncompressed (138 KiB gzip). The editor adds about 500 KiB on top; that is the place to look
first for a saving (a follow-up, since splitting code is a behaviour change and out of scope here).

## Owner questions

None.
