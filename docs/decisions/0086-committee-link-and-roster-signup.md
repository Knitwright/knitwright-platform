# 0086: Committee link v2 and roster sign-up

Status: Proposed; every number behind both links is a labelled default, owner questions listed
Date: 2026-11-02
Plan step: plans/platform-v5.md, workstream Z7 (spec features F-T3 and F-T4)

## Context

Two of the three people a club asks for something have no Knitwright account and never will: the
committee member who decides, and the teenager who tells you their shirt size. F-T3 asks for a
read-only link that shows up to three versions of a design, takes a comment pinned to a point of a
panel, an A/B/C vote and an approval given under a name, and lets the kit manager lock the version
the committee chose. F-T4 asks for a roster collected by pasting a list, importing a CSV or sharing
a player sign-up link, with duplicates flagged, profanity screened, name lengths checked per zone,
numbers configurable per sport, a collected-versus-missing grid, and a chase by WhatsApp or email.

Both are public, unauthenticated pages, which makes security the whole job rather than a part of it.
The platform already had one of these: the share link of decision 0026, extended by Y8 (decision
0081) with invites and link access. So the first decision was not how to build a public link; it was
not to build a second way of building one.

## Decision

### 1. Both links are the share link's idiom, not a new one

`supabase/migrations/20261120050000_committee_signup.sql` reuses decision 0026's parts rather than
restating them: `private.share_token_hash` hashes the token, the token is 256 random bits made by
the server and shown to the club once, only its hash is stored, and the one lookup is by the unique
hash so an unknown token, an expired link and a withdrawn link take the same path and give the same
answer: nothing. A visitor is known only by the SHA-256 of the link's id and the random key in their
cookie, so a browser cannot be followed from one link to another. Every write goes through a
`security definer` function only the server's own key may run, and the functions that take a token
hash it themselves, so a token never reaches a table.

Nine tables carry the work: `committee_links`, `committee_link_versions`, `committee_pins`,
`committee_votes`, `committee_approvals`, `committee_locks`, `roster_signup_links`,
`roster_signup_requests` and `roster_signup_entries`. Every one grants a browser `select` only, for
its own club, through a `private.is_member(brand_id)` policy. None has an insert, update or delete
policy, and none grants insert, update or delete to any role, not even the service role: deleting a
design, a season or a brand still removes the rows, because a cascade runs as the table's owner,
which no API role is.

### 2. A committee link lives at `/s/[token]`, the address a share link already uses

A visitor holds a token and nothing else, and the token decides what they may see. Giving the two
kinds of link two addresses would have told a visitor which kind they were holding before the
database had answered, so `app/s/[token]/page.tsx` tries a committee link first and an ordinary
share link second. A token opens one or the other, never both, and the database test proves it: a
committee token opens no sign-up link, no share link and no other design's version, and a sign-up
token opens no committee link.

There is deliberately no `loading.tsx` under `app/s/` or `app/join/`. A loading file flushes the
shell before the page runs, so `notFound()` could no longer set a 404 and a withdrawn link would
answer 200.

### 3. A link that is gone explains itself, and still answers 404

`app/s/[token]/not-found.tsx` and `app/join/[token]/not-found.tsx` say "This link does not work. It
may have run out, it may have been withdrawn, or the address may be wrong. Ask the person at the
club who sent it to you for a new one." The status stays 404 and the words are the same for all
three reasons, because telling them apart would say whether a link exists. What changed is only that
a committee member on a phone is no longer shown "there is nothing at this address".

### 4. An approval is a record, not a flag

`committee_approvals` holds who approved, under what name, at what time and against which version,
and `private.refuse_committee_record_change` refuses every update and every delete on it, on
`committee_pins` and on `committee_locks` — including from the owner of the table. The one exception
is a row whose link has already gone, which is what a cascade from a deleted design does; the credit
ledger (decision 0044) does the same and for the same reason. The database test proves the refusal
through `psql` as the table's owner, because no API role can even try.

The same browser pressing Approve twice on the same version changes nothing and returns the approval
it already made. Undoing an approval means recording another one, which is what a record means.

### 5. Locking goes through X4's status, and needs a version that has been checked

`public.committee_lock_version` writes its own record in `committee_locks` and then calls
`public.set_design_status` (plan v5 X4) to move that version to `approved`. It refuses a version with
no `design_statuses` row — a version that has never been checked against a factory profile — with the
message "This version has not been checked against a factory profile yet." A design locks once; a
second lock is refused.

A manager may lock a version nobody approved. The lock then names no approval and the screen says
so, because a club that has decided in a meeting should not have to stage an approval, and a lock
that silently implied one would be a claim nobody made.

### 6. A pin is a design comment, in the same shape

Decision 0063 already holds a comment pinned to a point: a panel id and a distance across and down
in millimetres. `committee_pins` holds exactly that, and `lib/share/committee/schemas.ts` cleans the
words with `lib/comments/text.ts`'s own cleaner, so a comment's length and its hidden-character rule
are decided in one place. A test fails if `PIN_MAX` and `COMMENT_MAX_LENGTH` ever drift apart.

A drawing on a public page is a picture, so it cannot be asked which panel a press landed on. The
panel is therefore chosen by name from the version's own panels, and the point comes either from
pressing the drawing or from one of nine named places — top left to bottom right — which a keyboard
reaches. `lib/share/committee/points.ts` keeps the two in step: a press selects the named place it
falls in, and a named place is the middle of its own third.

### 7. The read-only 3D view is the editor's viewer, behind the same button

`components/committee/Committee3D.tsx` loads `components/garment3d/GarmentViewer` only when a person
asks for it, which matters most on a phone. It has no control that changes anything. There is no
`SHOW_3D` switch in this path, following decision 0075: the drawing's outline is what the view is
built from, and it is built on the server by `flatPreview`, the same function the editor uses.

### 8. Every limit, range and word is a row

Four tables hold them, and no browser role reads any of the four: the pages they feed are drawn on
the server, and a club that could change its own number range or name length could ask for something
the factory cannot make.

| Row | Value | Rule | Where it came from |
|---|---|---|---|
| `public_link_windows.committee` | 30 days | `R-GAP-000` | F-T3, "links expire after 30 days" |
| `public_link_windows.roster_signup` | 30 days | `R-GAP-000` | Knitwright default, matched to the committee link |
| `sport_number_rules.default` | 0 to 99 | `R-GAP-000` | F-T4, "numbers are 0-99 by default" |
| `sport_number_rules` football, rugby | 1 to 99 | `R-GAP-000` | Knitwright default, no league rule book on file |
| `sport_number_rules` netball, hockey, basketball | 0 to 99 | `R-GAP-000` | Knitwright default, no league rule book on file |
| `shirt_zone_limits.back-name` | 12 characters | `R-PER-001` | The rulebook, word for word: "max 12 characters" |
| `shirt_zone_limits` the three number zones | 2 characters | `R-GAP-000` | The 0-99 range; R-PER-002 and R-PER-003 give heights, not lengths |
| `chase_templates` | two messages | — | Knitwright default wording, not reviewed by the owner |

`R-PER-001` is the only real rulebook entry among them. Nothing here invents a rule's text.

### 9. Numbers keep their digits, as a shirt does

`07` and `7` are different numbers on a shirt, so both the database and `lib/clubs/signup/numbers.ts`
keep the digits as typed, exactly as the roster already does (decision 0042). A leading zero is
allowed per sport, as a row.

### 10. Profanity goes through X8, and nothing else screens it

`lib/clubs/signup/submit.ts` calls `screenText` (decision 0073) with the context `name`, for the club
the token names, before anything is written. A blocked name is refused in moderation's own words; a
flagged name is kept and the verdict handed back, because "Arsenal" can be a nickname and a person
should decide. The order is the point of that file being its own: bot check, then the link's limit,
then the number against the sport's row, then the name against the zone's row, then moderation, then
the write.

### 11. The roster is still written by the club workspace's own writer

Nothing in `lib/clubs/signup` writes to `roster_players`. `mergeIntoRoster` builds the list and the
existing `replace_season_roster` (decision 0042) writes it, so a roster has one writer, one shape and
one set of rules. A player already on the roster keeps their place and takes their new number, size
and cut; a player who is not on it is added at the end; an answer that matches nobody is shown to the
club as "Not on your list" rather than dropped. "Saved sizes pre-fill next season" needed nothing new:
`start_next_season` already does it.

### 12. The grid is over the people the club is waiting on, not over the roster

A `roster_players` row cannot exist without a size, and the whole point of the grid is the people
whose size is not known yet, so `roster_signup_requests` holds the pasted or imported list and the
grid is over that. The missing are obvious three ways over, not by colour alone: the words "Still
waiting", a warm edge down the left of the row, and the missing sorted to the top.

### 13. WhatsApp needs no API, and email is the provider interface we already have

A `wa.me` address with the words already written opens the person's own WhatsApp and the club presses
send. Only digits reach the address and the words are escaped, so nothing a club pasted can change
where it goes. Email goes through `lib/share/email.ts`'s `EmailSender` (decision 0081), which sends
nothing at all until a provider and its key are set; no test and no local run reaches a provider.

The chase carries the link in its form, because a token is shown to the club once and never stored
and the server cannot look it up again. Only an address of this site, of the shape this server makes,
is accepted.

### 14. No delivery date is shown anywhere on either screen

The QC days and the freight days are both unset (plan v5 owner decisions), so neither the committee
page nor the sign-up page nor Collect shows a date. Where a date would belong, the screen says what
is missing instead.

## Where it lives

- `supabase/migrations/20261120050000_committee_signup.sql` — thirteen tables, twelve functions.
- `apps/web/lib/share/committee/**` — the slots, the pin's point, the tally, the page's view model,
  the public-write guard and the database calls.
- `apps/web/lib/clubs/signup/**` — the number range per sport, the name length per zone, the pasted
  list, the grid, the chase, the size guide, the fold into the roster and the submit guard.
- `apps/web/app/s/[token]/**` — extended for the committee link, with its own `not-found.tsx`.
- `apps/web/app/join/[token]/**` — the player's sign-up page, with its own `not-found.tsx`.
- `apps/web/app/(app)/collect/**` — the kit manager's screen for both.
- `apps/web/components/committee/**`, `components/signup/**`, `components/collect/**`.
- `apps/web/tests/integration/committee-signup.test.ts`, `e2e/committee.spec.ts`,
  `e2e/roster-signup.spec.ts`.

## Dependencies

None added. The 3D view is the three.js the platform already ships; the bot check is the Turnstile
the share page already uses; email is the Resend adapter decision 0081 already wrote.

## Left

- **No navigation entry.** Collect is at `/collect` and reachable by address only. The orchestrator
  asked for no new top-bar section while the studio header is out of width (three PRs were failing
  CI on that node), so one is owed: a "Collect" section, about 90 px, or a link from the club page.
- **`lib/deletion/team-data.ts` does not list the new personal-data tables.** `committee_pins`,
  `committee_votes`, `committee_approvals`, `roster_signup_requests` and `roster_signup_entries` hold
  people's names, and two hold email addresses. Every one goes with its design, its season or its
  club through its keys, and the database test proves the cascade. The file that lists such tables
  belongs to no workstream in this wave and its test reads a fixed list of migrations, so adding
  these is a follow-up, not a quiet edit.
- **A committee's pin is not shown back to the committee.** A visitor sees their own pin confirmed
  and the club sees them all. Showing one committee member another's comments would need a decision
  about who may read what through a shared link; owner question 5 below.
- **The CSV path is the one the club workspace already has.** F-T4 names CSV import as one of three
  ways to start a roster; `lib/clubs/roster.ts` does that today and nothing here changes it. The
  pasted list is the new one.
- **No per-player 3D preview.** F-T4's acceptance test also names "per-player 3D preview shows name
  and number on the back". The design holds one sample name and number (decision 0027) and the 3D
  view paints the drawing, so showing a particular player's name on it needs the names-and-numbers
  renderer to take a name per player. Not built; named here rather than left unsaid.

## Owner questions

1. **How long should a committee link last?** 30 days, from F-T3. A club that meets monthly may miss
   it by a week. Should the club choose, as a share link's 7, 30 or 90 days lets them?
2. **Should a committee member's email be asked for rather than offered?** Today a name is required
   and an email is optional and used for nothing: nobody is emailed. If approvals are to be chased,
   the address has to be asked for, with the consent record decision 0025 keeps.
3. **Numbers per sport.** Only football and rugby are seeded as 1 to 99 and the rest as 0 to 99, all
   as Knitwright defaults with no league rule book on file. Which leagues' rules should we hold, and
   where do we get them?
4. **Name length per zone.** The back name's 12 characters is R-PER-001 for JSY-SS-01, one article.
   The number zones' two characters is our own reading of the 0-99 range. What is the limit on the
   other articles, and does a longer name shrink to fit or get refused?
5. **What may a committee member see of another's comments?** Nothing today. Showing them would make
   the page a discussion, which is useful and is also a decision about personal data on a link
   anyone holding it can open.
6. **A unisex size guide.** The registry has no unisex wearer, so a unisex kit is shown the men's
   chart and the guide says so. Should unisex have a chart of its own?
7. **The chase wording.** Both messages are Knitwright defaults. What should they say, and should a
   second, firmer one exist?
8. **How many answers may one link take?** 300 answers, 300 comments and 300 votes per link, and 200
   people per season's list. A county-wide club could pass the last of those.
9. **Who may lock a version?** Anyone who may manage the kit: an owner, an admin or a kit manager.
   Should locking need an admin, given it moves a design to `approved` and cannot be undone?
10. **An approval cannot be withdrawn.** A committee member who changes their mind can only have
    another approval recorded, and the club reads the newest. Is that right, or should there be a
    way to record a withdrawal against an approval?
