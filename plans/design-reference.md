# Design reference: knitwright.com

Read from the live landing page at https://www.knitwright.com on 2026-09-27. The landing
page is the owner's own site and is the authority for the platform's look. Where this
file and the live site disagree, the live site wins; re-read it and update this file.

The landing page's source code is not in this folder. `kitwright/app/globals.css` holds
an older, related token set with different names. Use the values below, not those.

## What the site is

| Item | Value |
|---|---|
| Host | Vercel |
| Framework | Next.js with Turbopack, Tailwind v4 |
| Theme | Light only. No dark mode rules were found. |
| Title | Knitwright, "Sportswear from design to delivery" |
| Contact | hello@knitwright.com |

## Logo

A filled circle in ink with a white angular mark. Source of the mark as served at
`/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">
  <circle cx="140" cy="140" r="140" fill="#0f1012"/>
  <path fill="#fff" transform="translate(48.5 58.5)" d="M0 0H183L155 37ZM106 46H147L57 163Z"/>
</svg>
```

## Typeface

| Role | Family |
|---|---|
| Text and headings | Geist |
| Numbers, codes, measurements | Geist Mono |

Weights in use: 300, 400, 500, 600. Headings use tight letter spacing (-0.025em).
Small labels use wide letter spacing (0.05em).

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--canvas` | `#f4f4f5` | Page background |
| `--surface` | `#fff` | Cards and panels |
| `--shell` | `#ededee` | Frames around panels |
| `--ink` | `#0f1012` | Main text, logo |
| `--ink-2` | `#2a2c31` | Secondary text |
| `--muted` | `#62656d` | Supporting text |
| `--faint` | `#a3a6ad` | Placeholders, disabled |
| `--hairline` | `#0f101217` | Borders (ink at about 9% opacity) |
| `--tile` | `#17181b` | Dark feature tiles |
| `--tile-2` | `#222429` | Raised areas on dark tiles |
| `--chalk` | `#e9eaee` | Text on dark tiles |
| `--chalk-muted` | `#9a9ea8` | Supporting text on dark tiles |
| `--cobalt` | `#2b46f0` | The one accent: actions, links, selection |
| `--cobalt-soft` | `#8296ff` | Accent on dark tiles |
| `--cobalt-wash` | `#eef1ff` | Accent backgrounds |
| `--ok` | `#0f7b59` | Passed, verified |
| `--ok-wash` | `#e7f4ee` | Background for passed |
| `--warn` | `#9a5a08` | Needs attention |
| `--warn-wash` | `#f8efdf` | Background for attention |
| `--thread` | `linear-gradient(95deg, #b9c4ff 0%, #fff1c2 28%, #ffd3e6 52%, #c7f0e4 74%, #9fb0ff 100%)` | A thin decorative line. Used sparingly. |

## Shape and motion

| Item | Value |
|---|---|
| Corner radii | 0.25, 0.375, 0.5, 0.75, 1, 1.5 rem. Large panels use the larger radii. |
| Default transition | 150 ms, `cubic-bezier(.4, 0, .2, 1)` |
| Dark tiles | Fine dot grid (`radial-gradient` at 14 px) with an inset shadow |
| Chips | Fill animates outward from a point on the right |

## Provenance and status, mapped to these colours

| Meaning | Colour |
|---|---|
| Chosen or supplied by the brand | ink on surface |
| Suggested or proposed by AI | warn on warn-wash |
| Checked and signed by a person | ok on ok-wash |
| Action or selection | cobalt |

## Voice

Short, plain sentences. Direct claims with numbers. Second person. No jargon without an
explanation. Examples of its own headings: "A spec a factory can build from", "Change
the sleeve. Every number moves with it."

## What the landing page promises

The platform should match these, or the landing page should change.

| Promise on the site | Status in plan v3.1 |
|---|---|
| Upload a photo, sketch, reference product or moodboard, or describe it | In the MVP (steps 12, 13) |
| Tech pack in under 10 minutes | MVP target is under 5 |
| Annotated flats, graded size table, construction, fabric and trims | In the MVP (steps 7, 8) |
| Graded XS to 3XL | Size run comes from the owner (action A5) |
| Styles made today: crew, V-neck, raglan, polo, henley, training tees, club kit, base layers, run tops | All are tops |
| Change requests in plain language | In the MVP (step 12) |
| DXF pattern pieces, seam allowances, grading rules | Layer A, after launch |
| The flat, the table, the pattern and the 3D garment move together | Flat and table in the MVP. 3D garment in the MVP if the step 9A trial is accepted. Pattern in layer A. |
| Instant costing that shows its arithmetic | Layer C, after launch |
| Every spec checked and signed by name with a date | Sign-off record exists in the data model. No reviewer screen is planned yet. |
| Specs are never shown to another brand | In the MVP (step 3) |
| Export the full tech pack and DXF at any time | Tech pack in the MVP. DXF in layer A. |
| Sampling, bulk production, escrow, reorder | Not in this plan |

## Finish and motion (read from the live site, 2026-10-13)

The platform screenshots on knitwright.com are placeholders. Take the finish and motion below,
never the pictured screens. The studio app uses the dark side of this system throughout.

| Piece | Exact values |
|---|---|
| Glass panel | `backdrop-filter: blur(28px) saturate(1.6)`; background `rgba(12,13,18,.42)`; border `1px solid rgba(255,255,255,.22)` (use `.14` on busy app screens); `box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 30px 80px -30px rgba(0,0,0,.6)`. The inset line is the glossy top edge. |
| Header pill | Glass at `rgba(23,24,27,.52)`, `blur(24px) saturate(1.5)`, border white 12%, fully rounded, 64–70 px tall; background, border and shadow transition over 450 ms. |
| Thread ring | A 1.5 px border painted with `--thread`: a `::before` with `padding:1.5px`, `background:var(--thread)`, masked with `linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)`. On primary buttons and the brand card. |
| Primary button | Pill, `rgba(255,255,255,.05)`, thread ring. A white `chip-fill` layer grows from the arrow: `clip-path: circle(0 at calc(100% - 28px) 50%)` → `circle(150% …)`, 600 ms `cubic-bezier(.4,0,.2,1)`. Label turns ink over 500 ms. The arrow disc (`--thread` fill) turns 45° over 500 ms. |
| Card hover | Cobalt `fill-layer` grows from the pointer or bottom centre: `clip-path: circle(0 at var(--fx,50%) var(--fy,100%))` → `circle(160% …)`, 700 ms. Cards grow or lift with `cubic-bezier(.25,1,.5,1)` over 600 ms; captions slide up 20 px and fade in over 600 ms. |
| Headline reveal | `morph-reveal` 1 s `cubic-bezier(.25,.46,.45,.94)` 0.2 s delay: from `scaleY(0) scaleX(.8)`, opacity 0, overshoot to `scaleY(1.05)` at 60%, origin bottom centre. Gradient words use `--thread` clipped to text. |
| Background drift | `hero-drift` 24 s ease-in-out infinite alternate: `scale(1.02)` → `scale(1.1) translate(-1.5%,-1%)`. In the app: blurred thread-colour aurora behind the glass. |
| Status dots | `pulse-ring`: opacity .7 → 0, `scale(.9)` → `scale(1.9)`. |
| Marquee | 40–60 s linear, `translate(-50%)`. |
| Small links | Opacity .9 → 1 over 150 ms. |
| Reduced motion | Every animation off; reveals show at rest; fills show without movement. |

Mockup canvas: https://claude.ai/artifact/PFjUdQGjFuSeHyN3ceHD3U
