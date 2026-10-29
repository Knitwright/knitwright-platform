# 07 · Sportswear template library

Every template in Knitwright is sportswear-focused. A user should never start from a blank canvas unless they choose to. Templates are data, made and curated by Knitwright at launch, and are always tied to the 8 base articles in `articles/ONBOARDING.md`.

## Template types

| Type | What it is | Where it is used | Launch count |
|---|---|---|---|
| **Design template** | A finished design object on one base article: panel layers, colour roles, pattern fills, crest/sponsor/name/number slots | Teamwear configurator (F-T1), Studio editor (F-S4) | 60 |
| **Kit bundle template** | A set of design templates that belong together (shirt + shorts + socks colour; home / away / GK) | Crest-to-kit (F-T2), team stores | 15 |
| **Mockup scene** | A photographic or 3D scene that a design version is placed into, with the garment locked from the 3D render | Mockup studio (F-L1) | 40 |
| **Marketing template** | A layout for social posts, stories, ads, banners and printables, with slots for mockups, brand kit and text | Marketing studio (F-L2) | 50 |
| **Video template** | A short animated sequence using renders, mockups and brand kit | Video studio (F-L3) | 12 |
| **Flow template** | A saved chain of steps that turns one design into a full launch pack (see F-L4) | Flows (F-L4) | 6 |
| **Tech pack template** | Page set and default fields per base article | Tech pack builder (F-S6) | 8 (one per base) |

## Design templates (60 at launch)

Organised by sport → article → style. Every template exists on a real base article and passes validation before release.

| Sport / use | Articles | Styles (examples) |
|---|---|---|
| Football | JSY-SS-01, JSY-LS-01, SHO-TR-01 | Classic plain, vertical stripes, hoops, sash, half-and-half, chevron, gradient fade, pinstripe, retro 90s geometric, camo fade |
| Cricket | CRK-SS-01 | Coloured-clothing panels, side gradient, shoulder flash, minimal |
| Training | TEE-TR-01, JSY-SS-01, HOD-ST-01 | Club training, coaches' wear, pre-match, warm-up |
| Esports | JSY-SS-01 | Pixel/glitch, neon gradient, sponsor-heavy layout |
| Running / gym (brands) | JSY-SS-01, CMP-LS-01 | Reflective-look stripes, marble, tie-dye fade, minimal logo |
| Combat (brands) | FSH-MM-01, CMP-LS-01 | Rash-guard panels, tribal/geometric, fight-night |

**Each design template defines:**
- colour roles (primary, secondary, accent, trim), which the user's brand kit fills automatically;
- crest slot, up to 3 sponsor slots, name and number zones;
- which layers are locked (structure) and which are editable (colours, artwork);
- tags: sport, style, era, mood, colour family. The inspiration board (F-S1) and search use these.

## Mockup scenes (40 at launch)

All scenes use the exact garment from the deterministic 3D render or a golden-sample photo, never a regenerated garment.

| Group | Scenes |
|---|---|
| Product shots (deterministic, free) | Front / back / three-quarter / side 3D renders · flat lay on white · flat lay on grass · hanger on wall · folded stack · ghost mannequin |
| Teamwear | Kit laid out in a changing room · kit on a bench · team line-up (5 / 11 players) · captain holding shirt · pitch at night under floodlights · tunnel walk-out |
| Training & gym | Gym mirror · warm-up on a track · stretching on turf · weights rack |
| Running | City street run · trail at dawn · finish line |
| Combat | Cage / ring corner · dojo mat |
| Esports | Gaming desk with RGB lighting · stage with screens |
| Retail | Shop rail · e-commerce white background (square and 4:5) · lifestyle model studio colour backdrop |

**Each scene defines:**
- garment slots (1–11), each with a pose and camera;
- background, lighting and crop presets (1:1, 4:5, 9:16, 16:9);
- whether it is deterministic (free, from 3D) or AI-generated (credits);
- the model presets allowed (all AI-generated and licensed; no real people).

## Marketing templates (50 at launch)

| Group | Templates |
|---|---|
| Kit launch | "New kit" reveal post · home/away split · kit countdown story (3, 2, 1) · pre-order now · "Available now" with QR code |
| Club life | New signing · matchday · result · fixtures list · player of the match · sponsor thank-you · training session announcement |
| Team store | "Order your kit" with deadline · size reminder · last chance · store closed / kits arriving |
| Brand drop | Drop announcement · product feature (fabric, fit, features callouts) · size guide card · founder story · restock |
| E-commerce | Product listing images (white background, 4:5) · size chart image · feature callout image · Etsy/Shopify banner |
| Print | A4 poster · flyer · noticeboard QR poster for the clubhouse |

**Each marketing template has:**
- slots for mockups, brand kit (logo, colours, fonts) and text;
- formats: Instagram post 1:1 and 4:5, story/reel 9:16, TikTok 9:16, X/Facebook 16:9, A4 print;
- text fields with a character limit and an optional "write this for me" (AI copy in the brand's tone of voice).

## Video templates (12 at launch)

| Template | Length | Source |
|---|---|---|
| 360° kit turntable | 6 s | 3D model (free) |
| Front-to-back flip | 4 s | 3D model (free) |
| Kit reveal: fabric close-up → full shirt → crest | 8 s | 3D model + motion graphics |
| Home / away / GK carousel | 9 s | 3 renders |
| Launch countdown | 10 s | Marketing template + renders |
| Player walk-out (AI) | 5 s | Image-to-video from a mockup |
| Training clip (AI) | 5 s | Image-to-video from a mockup |
| Drop teaser with logo sting | 6 s | Brand kit + render |
| Size guide explainer | 10 s | Size chart + render |
| Feature callouts (fabric, seams, fit) | 8 s | Tech pack data + render |
| Team store "order now" | 6 s | Marketing template |
| Product carousel for Shopify | 12 s | 4 renders |

Formats: 9:16, 1:1 and 16:9, MP4 at 1080p. AI clips are labelled "AI-generated".

## Flow templates (6 at launch)

A flow template turns one design into a full launch pack in one run (F-L4).

| Flow | Steps | Output |
|---|---|---|
| Club kit launch pack | design → 6 product renders → 3 teamwear mockups → "new kit" post (1:1, 4:5, 9:16) → 360° turntable → "order your kit" story with QR | 14 assets |
| Brand drop pack | design → e-commerce listing images (white, 4:5) → 4 lifestyle mockups → drop announcement post + story → 2 AI clips | 16 assets |
| Team store promo | approved kit → order-now post + story → size reminder → last-chance story | 6 assets |
| Shopify product listing | design → 5 listing images → size chart image → product carousel video | 7 assets |
| Colourway set | design → 3 colourway variants → render each → comparison post | 7 assets |
| Sponsor pack | kit with sponsor → sponsor thank-you post → kit close-up on sponsor area → A4 poster | 4 assets |

## Rules for every template

- It is built on a live base article and passes F-0 validation and F-G1 moderation before release.
- It uses colour roles, never fixed colours, so the user's brand kit applies with one click.
- It never contains third-party logos, club crests (other than fictional demo crests), real player names or real people.
- All fonts and stock assets in templates are licensed for commercial use and for merchandise.
- Template metadata includes sport, article, style, mood and colour family, so search and the inspiration board can find it.
- Later (Phase 4), designer-made templates can be submitted, reviewed and paid a royalty per unit ordered.
