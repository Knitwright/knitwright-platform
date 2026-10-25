# 0063: Design comments (W4-D)

Status: Proposed. Owner questions listed.
Date: 2026-10-28
Plan step: platform-v4 W4-D

## Context

The spec wants committees and collaborators to talk about a design inside the workspace. Share
links (decision 0026) already let people without an account vote and comment on one saved version;
those answers are for visitors. This record is for the members of a brand talking among themselves,
anchored to a version and, if they like, to a panel or a point on it. Roles come from decision 0042.
Comment text is typed by people, so it is cleaned like a player's name (decision 0027).

## Decision

1. **Members only.** A comment is readable and writable by members of the design's brand, and by
   nobody else: not by a visitor with a share link, not by another brand. Nothing in `lib/share`,
   `app/s` or `components/share` reads comments, and a test fails if that changes
   (`lib/comments/members-only.test.ts`).
2. **Three tables**, all brand-scoped, row level security on, members read their brand, no browser
   write grant: `design_comments`, `design_comment_edits`, `design_comment_mentions`. Writes go
   through four functions only the server's key may run (`design_comment_add`, `_edit`, `_delete`,
   `_resolve`), which check the brand, the role and the author again. Routes refuse early for a
   clear answer; the route check is not what makes it safe. A comment refers to its design by
   `(project_id, brand_id)` with `on delete cascade`, so nothing refers into another workstream's tables.
3. **Threads.** A first comment starts a thread; replies point at it and do not nest. A reply takes its
   thread's version and has no anchor of its own. Resolving applies to a thread's first comment.
4. **Anchor.** A comment names a saved version (1 up to the design's current version), optionally a
   panel id, and optionally a point on that panel in millimetres (both distances or neither; a point needs a
   panel). Distances are limited to 0 to 5000 mm. The panel list in the form is the design's own panels
   (`panelsFor`); the panel id is not checked against the garment in the database, because the garment rules live in
   the app and a panel can change name between versions.
5. **Roles.** Every member (owner, admin, kit manager, viewer) may read and comment. Owners, admins and
   kit managers may resolve and open a thread again (the same `can_manage_kit` rule as the kit). A viewer
   cannot resolve. The author alone may change or remove their comment, and only for 15 minutes after
   writing it; nobody else, an admin included, can edit another person's words.
6. **Append-only history.** A change copies the earlier words into `design_comment_edits` first. That
   table can be read by members and never updated or deleted (trigger plus no write grant, even for the
   server's key). It goes only with its comment: when the design or brand is deleted, or when the author
   removes a comment that has replies.
7. **Removing.** A comment nobody replied to is deleted. One with replies stays as an empty line (`deleted_at`
   set, words empty) so the replies keep their place; its earlier words and mentions are erased at once.
8. **Text** is cleaned in `lib/comments/text.ts` the way `cleanName` cleans names (composed form, hidden
   and direction-override characters removed, one space between words), but it keeps line breaks and allows
   any letters, up to 2000 characters. It is shown as plain text only (React escapes it); markup is not
   interpreted.
9. **Mentions** name members of the same brand only: the database refuses anyone who is not a member and at
   most 10 names per comment; the writer is dropped from their own list. The browser picks names from the
   member list; the words are not parsed for `@`. No email is sent: a mention shows as an in-app count
   ("2 open comments name you") at the top of the Comments tool. A resolved thread or a removed comment
   no longer counts.
10. **Limits.** 2000 characters, 30 comments per person per 10 minutes and 500 comments per design and 200
    replies per thread (all in the database), plus a per-address route limit (`LIMITS.commentWrite` and `commentChange`, two lines added to
    `lib/server/limits.ts` because an architecture test requires every route to name its limit there). `lib/comments/limits.test.ts` reads the
    migration and fails if the numbers in the app and the database drift apart.
11. **Erasure.** The three tables are listed in `lib/deletion/team-data.ts`, whose test reads the migration:
    deleting a design deletes its comments, their earlier words and mentions through the keys; deleting a
    brand does too; deleting an account sets `author_id` to null (the words stay under "A former member")
    and removes the person's mentions.
12. **Workspace.** One new tool, "Comments", on the rail between Ideas and History. It loads the list from
    `GET /api/projects/{id}/comments` and sends changes to the same route, `/{commentId}` and
    `/{commentId}/resolve`.

## Evidence

| Claim | Test |
|---|---|
| Roles, anchors, replies, resolve, mentions, edit and remove rules, append-only history, no cross-brand reads, erasure with the design | `tests/integration/design-comments.test.ts` |
| Browsers read only their own brand's rows, write nothing, call no function | `tests/integration/isolation.test.ts` (three new tables) |
| Cleaning, schemas, threads, window, counts, error mapping, answers | `lib/comments/*.test.ts` |
| Limits in the app match the migration; grants and policies in the migration | `lib/comments/limits.test.ts` |
| Share links never touch comments; routes need a member | `lib/comments/members-only.test.ts` |
| Tables are in the erasure list | `lib/deletion/team-data.test.ts` |
| Comment, reply, change, resolve; another brand sees nothing; no session is refused | `e2e/comments.spec.ts` |

Not run in the cloud sandbox (no Docker): the database tests and the end-to-end spec. CI runs them.
Not tested anywhere: the 15-minute window closing (a test would need to move the database clock or rewrite
`created_at`, which no role may do); it is covered by the window rule in `lib/comments/thread.ts` and read
by eye in the migration.

## Owner questions

1. Is 15 minutes the right window for changing or removing a comment? (Starting point, not from the spec.)
2. Should an admin or owner be able to remove another member's comment (for abuse)? Not built.
3. When should a mention stop counting for a person: when the thread is resolved (built), or when they have
   seen it? "Seen" needs a read marker per person and was left out.
4. Should a brand's comments be shown to a designer or partner who is not a member? Not built: members only.
5. Email for mentions, when an email channel exists.

## Alternatives

- **Reuse share-link comments.** Those are visitor answers keyed by a browser, with no member identity. Mixing
  them would put committee-only talk one bug away from a public page.
- **Hard delete always.** Simple, but a reply would vanish with its parent; an empty line keeps the thread readable.
- **Parse `@names` from the text.** Names are not unique and change; a picker is unambiguous.
