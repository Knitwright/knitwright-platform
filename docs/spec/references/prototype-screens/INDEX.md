# Prototype screens

There are 109 images of every screen and state in `prototype/index.html`, captured at **1440 × 900** (1×, Chrome).
- Files ending `-full` are the same page captured at full length, for pages that scroll.
- To open any state live, use `prototype/index.html?shot=<file name without .png>`.
- Screen numbers (#) refer to `09-screen-map.md`.

**How to use these:**
- Build each screen to match its image at 1440 × 900, using the components and tokens in `10-design-system.md`. **Exact values come from `10`, not from measuring pixels.**
- Attach a side-by-side screenshot to every UI pull request.
- Content (Lahore Lions FC, prices, garments drawn as flat icons) is placeholder. The real product uses real renders, mockup photos and template artwork.

## Dashboard (d)

| File | Screen | # |
|---|---|---|
| d01-projects | Projects, Kittl grid (New, projects with artboard count, tutorials) | 14 |
| d02-projects-recent | Recent: Fabra-style home (start cards, Jump back in) | 14 |
| d03 – d05 | Folders, Shared, Trash (empty states) | 14 |
| d06-projects-ai | AI Creations masonry | 14 |
| d07-ai-studio | AI Studio home (hero, Ask Creative Agent, workflows) | 3 |
| d08-ai-workflows | AI Workflows tab | 3 |
| d09-creative-agent | Creative Agent chat | 2 |
| d10-workflow-crest-to-kit | A workflow page (form + results) | 4 |
| d11-ai-image, d12-ai-video | Image and video generators | 5, 6 |
| d13-templates | Templates | 7 |
| d14-mockups | Mockups | 8 |
| d15-marketing | Marketing | 9 |
| d16-brand-empty, d17-brand | Brand: empty and filled | 18 |
| d18-team, d19-settings | Team, Settings | 17, 19 |
| d20-modal-new-design | Create a new design modal | 28 |

## Catalogue, products, orders, store (p)

| File | Screen | # |
|---|---|---|
| p01-catalogue | Catalogue home | 10 |
| p02-category | Category page with filters | 22 |
| p03-product-detail | Product detail (methods, Made by Knitwright, size guide) | 11 |
| p04-modal-configurator | Product configurator modal | 28 |
| p05-my-products | My products | 10 |
| p06-listing-editor | Listing editor | 23 |
| p07-modal-mockup-library | Mockup library modal | 23 |
| p08-trending-ideas | Trending ideas | 26 |
| p09-orders, p10-orders-empty | Orders list and empty state | 15 |
| p11-order-detail | Order detail | 33 |
| p12-range-plan-list, p13-range-plan-board | Range plan: list and board | 15, 32 |
| p14-store | Store overview | 16 |
| p15-store-channels, p16-modal-connect-store | Sales channels and Connect modal | 24 |
| p17-store-settings, p18-store-branding | Store settings (GPSR, EPR), Branding | 25 |

## Editor (e)

| File | Screen |
|---|---|
| (all) | All editor states belong to screen **12** (Editor) and **13** (Order drawer) |
| e01-editor | Editor canvas with all boards, nothing selected |
| e02-modal-artboard-size | Choose Artboard Size modal |
| e03 – e14 | Left-rail panels: Products, Templates, Text, Illustrations, AI Gallery, Mockups, Uploads, More, Learn, Layers, Brand, Team |
| e15 – e21 | Selected: Garment board, Mockup, AI image, AI video, Artboard, Tech pack board, Order board (inspector and task bar for each) |
| e22 – e25 | Selected element: Text, Image, Group, Illustration |
| e26-mockup-edit-mode | Mockup edit mode (double-click) |
| e27 – e31 | Popovers: Export, Share, Publish, Order, Version history |
| e32-font-picker, e33-colour-picker | Font picker; colour picker |
| e34-prompt-bar-open | Prompt bar expanded |
| e35 – e37 | Menus: context (⋯), zoom, task-bar "n more" |
| e38 – e42 | Modals: Browse styles, Prompt builder, Prompts, Product info, Plans |
| e43-presentation, e44-error-toast | Presentation mode; error toast |

## Garment Studio and tech pack (s, x)

| File | Screen |
|---|---|
| s01-studio-welcome | First-open welcome (beta) modal |
| s02-studio-3d, s03-studio-2d-pattern | 3D view; 2D pattern pieces |
| s04 – s07 | Library panels: Colours, Repeats, Graphics, Trims (Fabrics is in s02) |
| s08 – s14 | (screen 30) Tech pack tabs: Overview, Body, Measurements, Materials, Callouts, Artworks, Labels |
| s15-tech-pack-inches | Measurements in inches |
| s16-studio-export-panel | Export panel |
| s17-menu-colourway, s18-menu-size | Colourway and size menus |
| s19-modal-tech-pack-upgrade | Upgrade to export tech packs |
| x01 – x08 | (screen 31) Exported tech pack sheets: Overview, Colourways, Measurements, Size chart, Callouts, Materials, Artworks, Labels |
