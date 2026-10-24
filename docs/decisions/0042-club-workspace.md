# 0042: Club workspace (V4)

Status: Accepted
Date: 2026-10-24
Plan step: platform-v4 V4

## Context

The product spec wants one account per club, with members and roles, and a workspace that holds the
club kit (colours, crest, sponsors, fonts), every design, rosters by season, order history, and saved
sizes per player so next season is pre-filled. A small brand works the same way with a brand kit.

Today's unit is `brands` with `memberships` (decision 0004). There is one role, `owner`, and no way to
add a second person. Team lists for one order are `team_orders` (decision 0032). Player names are
personal data (decision 0027).

## Decision

1. **A club is a brand.** No parallel account concept was added. A club, a school and a small brand
   are all `brands`; "organisation type" (decision 0024) already says which. The club workspace is the
   `/club` page of the brand a person is working in.
2. **Roles extend `memberships.role`.** The check now allows `owner`, `admin`, `kit_manager`, `viewer`.
   No row was rewritten. Everyone who exists stays `owner`.

   | Role | Kit, seasons, rosters | Members and roles |
   |---|---|---|
   | owner | change | change; cannot be changed or removed |
   | admin | change | change |
   | kit_manager | change | look only |
   | viewer | look only | look only |

   The database enforces every row of that table inside each club function (`private.can_manage_kit`,
   `private.can_manage_members`). Routes also refuse early, for a clear answer; the route check is not
   what makes it safe. No browser can write `memberships`, as before.
3. **Four new tables**, all brand-scoped, row level security on, members read their own brand, no browser
   write grant, writes through functions only the server's key may run:
   `club_kits` (one row per brand), `club_seasons`, `roster_players`, `club_invitations`.
   Crest and sponsor logos are file ids, not keys, so a removed file cannot block anything and nothing
   refers into another workstream's tables.
4. **Seasons and rosters.** A roster player is a name, a number, a size label and a wearer group
   (men's, women's, junior, unisex: the same four cuts as team orders). `start_next_season` copies a
   season's players, sizes included, into a new season in one step; the two rosters are independent after
   that. CSV import reuses `lib/orders/import-csv` and `cleanName`, so names are cleaned and refused
   by the same rules as a team order. Import shows a preview and saves nothing; saving is a separate step
   that replaces the roster in one transaction.
5. **Invitations without email.** The platform has no way to send an invitation email and the owner has
   not chosen one. An admin invites an address; the invitation shows on `/club` for the person who signs
   in with that same, confirmed address, and they press Join. `accept_invitation` checks the address
   inside the database, so an invitation cannot be accepted by anyone else, and still applies the
   3-brands-per-person cap.
6. **Erasure.** Every new table goes with its brand (`on delete cascade`), and `roster_players` goes
   with its season. A person can also be erased on their own (`erase_roster_player`), a season with its
   roster (`delete_club_season`), and an invitation cancelled. `lib/deletion/team-data.ts` lists the
   tables, and its test fails if the club migration gains a table that the list does not name, or if
   an erasing function is callable by a browser. Account deletion already deletes a brand's rows; it
   still refuses while another member would lose the club (`shared_brand`), which now matters.
7. **Applying the kit to a design** is `lib/clubs/apply-kit.ts`: a pure function from the design and the
   kit to ordinary design changes (a "Club colours" colourway, a crest, up to three sponsors), saved as
   ONE new version by the existing `saveActions`, so one undo takes it back. The design keeps its own
   copy and holds no link to the kit. Applying twice updates rather than duplicates.
   Where the crest and sponsors go (left chest, centre chest, sleeves) and how big they start are
   labelled starting points, not club rules; the notes shown after applying say so.
8. **Order history** reads `production_releases` for the brand, read only.

## Evidence

| Claim | Test |
|---|---|
| Roles are enforced in the database, across two clubs, with no leakage | `tests/integration/club-workspace.test.ts` |
| Browsers read only their own brand's new rows and cannot write them | `tests/integration/isolation.test.ts` (four new tables, three new callable functions) |
| Roster players go with the season, the brand and the account | `club-workspace.test.ts` (erasure, deleting an account), `lib/deletion/team-data.test.ts` |
| A viewer cannot change a roster in the browser | `e2e/club.spec.ts` |
| Create a season, import a roster, copy to next season | `e2e/club.spec.ts` |
| Applying the kit is deterministic, repeatable and invents nothing | `lib/clubs/apply-kit.test.ts` |

## Alternatives

- **A new `clubs` table next to `brands`.** Rejected: two account concepts, two sets of isolation
  rules, and every existing brand-scoped table would need to learn about both.
- **Sending invitation emails now.** Needs a mail provider and a template and an owner decision.
  Left for later; the page says plainly that no email is sent.
- **Storing the kit inside `brands`.** Rejected: `brands` is read by every page; the kit is its own row
  and can grow (fonts, more sponsors) without touching it.
- **Linking a design to the kit so it follows changes.** Rejected by the spec's own wording ("the design
  keeps its own copy"); a design that changed under a signed-off release would be a hazard.

## Consequences

- Every existing design route lets any member write a design (members could always edit designs, and
  there was only one role). A `viewer` can therefore still edit designs through the older design routes.
  Those routes belong to other sections and were not changed; see the PR comment. The new club routes
  refuse a viewer.
- The `brands` page and the brand switcher show an invited person the club only after they accept.
- A person with no brand of their own is sent to create one before they can see an invitation.

## Owner questions

1. **Invitations by email?** Which provider, and what should the message say? Until then an admin tells
   the person to sign in with the invited address and open Club.
2. **Fonts.** Only Geist is bundled, so names and numbers have no choice yet. Which fonts should be
   bundled (licences) for club lettering?
3. **Crest and sponsor places and sizes.** The starting places (left chest, centre chest, each sleeve) and
   sizes (80 mm crest, 200 by 50 mm chest sponsor, 80 by 30 mm sleeve sponsor) are Knitwright defaults, not
   from a club or a league. Are there league rules on sponsor size and place?
4. **Roles.** Is "kit manager cannot change members" what clubs expect? Should a viewer see the order
   history and the roster (today they do)?
5. **Roster details.** Does a roster need more per player (date of birth for junior age groups, a
   guardian contact)? Those would be more personal data and need their own consent wording.
6. **Limits.** 20 seasons, 1000 players a season, 50 members and invitations per club. Right sizes?
7. **Small brands.** A "product list" for a small brand (the spec's last line) is not built. Is it the
   designs list, or a separate catalogue?
8. **Should viewers be allowed to edit designs?** Today every member can (see Consequences).
