# 0004: Brands, isolation and file storage

Status: Accepted
Date: 2026-09-29
Plan step: 3

## Context

Designs are confidential to the brand that owns them. A user may belong to several
brands, so every request needs to know which one the user is working in. Acceptance
criterion M5: one brand can never read another brand's designs, files or images.

## Decision

1. **Two tables, `brands` and `memberships`, that no browser may write to.** Changes go
   through `create_brand` and `rename_brand`, which check who is calling. The MVP has one
   role, `owner`. A user may belong to 3 brands. The cap holds when requests arrive
   together, because each user's requests are taken in turn.
2. **Row level security on every table**, with policies that call
   `private.is_member(brand)`. It runs with its owner's rights, so a policy on
   `memberships` does not have to read `memberships` itself, which would never end.
3. **The brand a user is working in is a preference, kept in a cookie.** On every
   request the database is asked which brands the user belongs to. A cookie that names
   any other brand is ignored.
4. **Three kinds of access**, written on every route and action: `member` (a session
   and a brand), `user` (a session only, for the few things done before a brand
   exists), and `public`.
5. **Every page in the studio checks the session and the brand itself**, with
   `requireMember()`. The architecture test fails for a page that leaves it to the
   layout. The framework does not run a layout again when the user moves between the
   pages inside it. `requireMember()` is the plan's `verifySession()`.
6. **Three private buckets.** Every path starts with the brand's id. Members may read
   their brand's files. **No browser may write to storage.** The server checks every
   upload and writes the file itself.
7. **One upload helper**, `lib/storage/image.ts`. The file is opened as an image and
   written out again, so what is stored is only pixels: no camera or location details,
   no script, nothing that was appended. It refuses anything that is not PNG, JPEG or
   WebP, anything over 8 MB, and anything over 40 megapixels. SVG is refused. The result
   is stored as PNG or JPEG, the two formats the PDF export can draw.
8. **One way out of storage**: `GET /api/files/[id]/link`, which returns a link that
   stops working after 60 seconds. A file is asked for by its id, never by its path.
9. **The isolation suite asks the database what exists.** A new table, bucket or
   function that is not described in the suite makes it fail, so nothing can be added
   without deciding who may reach it.

## Evidence

| Claim | Test |
|---|---|
| The isolation suite passes | `tests/integration/isolation.test.ts`, 62 cases |
| The suite fails when access is loosened | Checked by hand on 2026-09-29: a permissive policy, an extra grant, an open storage policy and an exposed function made 10 cases fail. They were then removed. |
| Brand B cannot obtain a link to brand A's file | `tests/integration/storage-service.test.ts`, `e2e/brands.spec.ts` |
| A fourth brand is refused, also when ten requests arrive at once | `tests/integration/brands.test.ts` |
| A user cannot change their own role or join a brand | `tests/integration/isolation.test.ts` |
| A cookie naming another brand opens nothing | `lib/brands/active.test.ts`, `e2e/brands.spec.ts` |
| Uploads are stripped of details and appended data | `lib/storage/image.test.ts`, 21 cases |
| A studio page that does not check the session fails the build | `tests/architecture/wrapper-check.test.ts` |
| No session, no access, for the new routes | `e2e/unauthenticated.spec.ts` found them on disk with no change to the test |

## Alternatives

- **Letting browsers upload straight to storage** with a policy on the path. The file
  would reach storage before anything had looked inside it.
- **Keeping the active brand in the database**, one for each user. It would follow the
  user across browsers, but a user working in two brands in two windows would find each
  window changing the other.
- **Storing every upload as WebP**, which is smaller. The PDF library cannot draw it.
- **Generated database types.** Rows are checked with Zod where they are read instead,
  which also checks them at run time.

## Consequences

- A user with two brands can ask for a file only in the brand they are working in, even
  though they belong to the other one too. They switch brands first.
- An uploaded PNG stays a PNG, so the flat colours of a logo stay exact. A photograph
  sent as PNG is stored larger than it would be as JPEG.
- Deleting a brand, leaving one, and inviting people are not built. Roles and
  invitations are layer E. Deleting an account and its files is step 26.
- The `exports` bucket exists but nothing writes to it: exports are built when they are
  downloaded and are not stored (plan, cost rule 6).
