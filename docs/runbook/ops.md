# Ops runbook

For the person who runs the weekly production cycle in the ops console (`/ops`). Written from the code and from decisions
0018, 0032, 0043, 0044, 0050, 0051, 0054, 0060, 0062 and 0065. Where the code does not do something, this runbook says so
instead of guessing. Hosting steps (Supabase, Vercel) are in `docs/runbooks/supabase-hosted.md`.

## Ground rules

- **Who can open `/ops`:** platform admins only. Anyone else gets the page that does not exist. The factory never logs in.
- **Nothing is sent from the platform.** No email, no courier call, no message to the factory. A person downloads a file and
  sends it.
- **Status history is append-only.** A wrong step cannot be edited out. Correct it with a new step, a delay, or an exception, and
  write the reason.
- **No player names in notes.** Names live in the team list and are erased with it. Notes could outlive that, so keep them to
  order and size facts.
- **Every number you see comes from the Store, the factory or a person.** "Not set" means nobody has answered yet
  (`docs/owner/settings-console-guide.md`). Do not fill a gap with a guess.
- **Order of the work:** order arrives, batch, factory sheet, factory status, QC, packing, shipping. Exceptions can open at any
  step.

## 1. How an order arrives

The Store (outside this repo) calls `public.submit_order_for_production` with a frozen release, its own order reference, a factory
profile id, a fabric key, an article and a size breakdown (decision 0043). The platform reads the brand, design and file count
from the release, never from the caller. A brand run (decision 0062) reaches ops through the same door, with the reference
`brand-run:<brand>:<request key>`.

- The order starts **Waiting for a batch** (`submitted`). Its cut-off is the next weekly cut-off at or after that moment.
- The promised date is the cut-off date plus the lead time, fixed at that moment. **No lead time set means no promised date**
  and the screen shows "Not set". Changing the setting later does not move orders already submitted.
- Sending the same reference and release again returns the same order and writes nothing. The same reference with another
  release is refused (`external_ref_conflict`). If the Store reports a double order, look the reference up before doing anything.
- The overview page `/ops` shows this week's numbers: orders this week, pieces in production, on-time rate, defect rate by
  factory, remakes open, value in open batches and the next cut-off. A table over 5,000 rows makes the page say its numbers cover
  the newest rows only.

## 2. Weekly batches

1. Wait until the cut-off has passed (default Friday 17:00 UTC; set in `/admin/settings`, group "Weekly batch").
2. On `/ops`, press **Cut batches now**. It puts every waiting order whose cut-off has come into a batch: one batch per
   factory, fabric, article and cut-off. **Nothing does this on a timer** (owner question O4). If nobody presses it, orders wait.
3. Open each batch at `/ops/batches/<id>`.
   - **Factory sheet:** an A4 PDF, same bytes for the same batch (`/api/ops/batches/<id>/factory-sheet`). It lists orders,
     pieces by size, name and number lists, packing text and the due date. Fabric quantity and trims read "Not set" because
     the platform has no cut plan or trim list. The packing text is a Knitwright default.
   - **Print files ZIP:** one folder per order and a `manifest.csv` (`/api/ops/batches/<id>/print-files`). The files are built
     again from each release. **Do not send a line that says "differs from the release".** Stop and open an exception for that
     order (section 6). A line "not in the release" means the release holds no such file.
   - If a team list and the order disagree on piece counts, the sheet says so at the top. Settle it with the club or the Store
     before sending.
4. Send the sheet and ZIP to the factory yourself.

### Holding and moving an order

- **Hold:** keeps an order out of every batch. Allowed only while it is Waiting for a batch or In a batch.
- **Release the hold:** the order waits for the next cut.
- **Move:** to another batch of the **same** factory, fabric and article. Any other batch is refused. Allowed while waiting, in a
  batch, or on hold.
- Once the factory has marked an order received, ops can no longer hold or move it. Use a delay or an exception.

## 3. Factory status

Record what the factory tells you, one step at a time, never backwards: In a batch, Received by the factory, In production,
Ready. A skipped step is refused.

- **Delay:** moves the promised date later (never earlier or the same) and needs a reason of up to 300 characters. Allowed while
  the order is in a batch, received or in production. It writes an event with the new date and the reason.
- Brands do not see the delay. Members can read events at the database level, but no screen shows them (decision 0043, O8).

## 4. Quality control

An order is inspected once the factory marks it **Ready**. Open `/ops/orders/<id>/qc` (decision 0050).

1. Fill in the four checklist items: measurements against the size spec on a sample, colour against the swatch, artwork
   placement, names and numbers against the team list. Each is pass, fail or not inspected.
2. Enter the pieces inspected and the pieces with a defect, photo file ids if any, and one measurement line per row: point,
   spec, measured, tolerance, in mm.
3. **You do not type the result.** It is worked out: pass only when all four items pass, at least one measurement is recorded,
   every measurement is inside the tolerance you typed, and no inspected piece is defective. The default defect rule is zero
   and is labelled "Knitwright default, not agreed with a factory".
4. A new inspection never replaces an old one. The latest decides. If an inspection was entered wrongly, inspect again.
5. **A fail needs** the pieces to make again (by size), an owner and a due date. Saving it opens a **remake** line in the same
   step (section 6).

The platform does not tell the factory about a remake (owner question Q3). Put it on the next batch's sheet, or tell them directly.

## 5. Packing and shipping

**Packing** (`/ops/orders/<id>/packing`): bags are made from the team list, one per line in list order; with no list, one per
size. Bags store no name; the label is built when you print the packing list. Add cartons with weight (grams) and size (mm). An
empty box prints "Not set". Download the packing list from `/api/ops/orders/<id>/packing-list`. Warnings on the list: pieces in bags
differ from the order, cartons without weight or size, bags not packed, a team list that is gone.

**Shipping** (`/ops/orders/<id>/shipping`): type the courier, tracking number, day sent and pieces by size. No courier is called
and no tracking link is invented.

- Refused with `qc_not_passed` unless the order is Ready **and its latest inspection is a pass**. Run QC first.
- Refused with `over_shipped` if you enter more of a size than the order still owes.
- A parcel that leaves pieces behind needs an owner and a due date for the rest, and opens a partial shipment exception.
- "Shipped" is worked out from the parcels, not set by hand. The order keeps the status the factory set. An order counts as shipped
  when its parcels cover its pieces.
- A parcel recorded wrongly cannot be deleted (the table is append-only). Raise an exception of kind lost parcel or size swap and
  say what is true.

## 6. Exceptions

Open `/ops/exceptions`. Kinds: **remake**, **partial shipment**, **lost parcel**, **size swap**. Each needs an owner (a name; a
factory contact can own one) and a due date. Overdue means open and past its due date, shown first.

- **Raise exception** from an order page, with a note ("What happened", up to 300 characters).
- **Change owner or date** adds a history line each time.
- **Resolve** closes it once, with "How it was resolved". It cannot be reopened; raise a new one.
- Remakes opened by a failed inspection appear here, and are counted on `/ops` as "Remakes open".

## 7. Credits

A brand's balance is the sum of its ledger (`credit_ledger`), never a stored number. It is read on `/credits` (the brand's page).
There is no admin screen for the ledger and **no adjustment line**: the only kinds are grant, spend, refund and expire
(decision 0044).

- **Charging is off by default** (`CREDITS_ENFORCED`, decision 0051). With it off, no brand is charged and the log records what
  an output would have cost. Do not tell a brand it was charged unless the flag is on.
- **Price or allowance wrong:** change it in `/admin/settings`, group "Credits". It applies to later spends; the ledger is not
  rewritten.
- **A repeat download costs nothing.** A spend is keyed by output kind and design version, so the same output of the same version
  is not charged twice.
- **Refund on order** happens once per spend on that design version. The function exists (`orderDesignVersion`,
  `lib/credits-gate/order.ts`), **but no screen or route calls it yet**, so today nothing is refunded on order. Do not promise a
  refund until that is wired.
- **A failed photoreal job** gives its metered cost back automatically (decision 0018).
- **Only the database owner can fix a ledger mistake**, by adding a refund or grant line through the functions. Direct edits are
  refused, even for the server's key. Ask a developer.

## 8. Pattern requests

Brands ask the Sialkot team for a pattern for garments the library cannot draft (decision 0060). Open `/ops/pattern-requests`.

| Status | Words on screen | Next allowed |
|---|---|---|
| requested | Requested | accepted, declined |
| accepted | Accepted by the Sialkot team | in progress, declined |
| in_progress | Being drafted | delivered, declined |
| delivered | Delivered | none |
| declined | Declined | none |

- **Accept / in progress:** one step at a time.
- **Attach files:** DXF only; the bytes are read to be sure. Delivery needs at least one file.
- **Record the review:** the technician's name and date. Until you do, brands see "Pattern from the Sialkot team, not reviewed by a
  technician".
- **Decline:** needs a reason and gives the credits back once. The brand cannot ask again for the same version; they save a new one.
- The price and turnaround a brand sees are what the settings said when it asked. With none set, the screen says Knitwright will
  confirm. Nothing is emailed; the brand sees the status in the app.
- A request carries the design and a hash of it, never a roster or player names.

## 9. Reorders

- **Club reorder** (decision 0065): the club's kit manager presses **Reorder** on a line in the club's order history, reviews it, and
  confirms. It saves a **new team order** ("Reorder of <label>") on the same design. It does **not** make a release and does
  **not** reach ops. A person on the club side then goes through the normal release and order flow.
- If the plan changed between review and confirm (a roster edited elsewhere), the server refuses and the person starts again.
- The review does **not** rebuild the print files. It says so in plain words. Files are rebuilt at release (decision 0032), and the
  factory sheet ZIP shows "differs from the release" if they would change.
- **Brand reorder:** a brand freezes a new release and submits another run (decision 0062). Same door, a new request key.

## 10. Stuck orders: what to do

| What you see | Likely cause | Do this |
|---|---|---|
| Order stays "Waiting for a batch" after the cut-off | Nobody pressed **Cut batches now**, or the order is on hold | Press it. Check the hold. |
| No promised date | No lead time set | Set it in `/admin/settings` (affects new orders only). For an existing order, use a **Delay** once it is in a batch. |
| Cannot hold or move | The factory has already received it | Use a delay or an exception. |
| Cannot mark a status | A step was skipped | Mark the one in between first. |
| Cannot record a parcel | `qc_not_passed` or `over_shipped` | Run QC and fix it, or correct the sizes. |
| Factory is late | The promise slipped | **Delay** with a reason. |
| Sheet says piece counts differ | Team list and order disagree | Settle it with the club or the Store, then resend. |
| ZIP line says "differs from the release" | A file would not match what the club saw | Do not print it. Raise an exception and ask a developer. |
| Store says it sent an order that is not here | The call failed, or the release is missing | Ask the Store for the reference and the error. A retry with the same reference is safe. |
| Photoreal images stuck on "queued" or "running" | The background job was lost | The poll gives up a job after 3 minutes and refunds the cost. The member starts the images again from the design. |
| Media set says failed | The provider failed | A failed set starts again when the member asks (decision 0054). |

## 11. Rerunning jobs

There is no job queue to restart from the console. Each kind of background work is started again by the person who needs it, or by
re-sending the same request.

| Work | How it runs | To run it again |
|---|---|---|
| Photoreal images (`jobs` table, decision 0018) | Started by a route, carried on after the response. A job unfinished after 3 minutes is given up and its cost refunded once. | The member presses the button again on the same design. |
| Media sets and clips (decisions 0054, 0058) | Same pattern. A request for a version that already has a set returns that set. | A set that **failed** starts again on request. A set that succeeded is returned, not remade. |
| Cutting batches | Manual. | Press **Cut batches now** again. It only picks up orders not already in a batch. |
| Factory sheet, packing list, print files ZIP | Built on request, same bytes for the same data. | Download again. Nothing to rerun. |
| Order intake from the Store | Idempotent on the Store's reference. | Call it again with the same reference. |
| A brand run | Idempotent on the request key. | Press again; one order results. |
| Pattern drafting | People. | Change the request status; the history is append-only. |
| Providers without a key | The platform runs a stand-in or says "not available" (see `README.md`). | Set the key in the host's environment, then ask the member to try again. |

If a job keeps failing, read the host's logs and the Sentry project once `MONITORING_DSN` is set (decision 0023). Provider error text is never shown to
members; a failed job shows a safe sentence.

## 12. When to stop and ask a developer

- A ledger line is wrong.
- Two orders share a reference but differ.
- A "differs from the release" line.
- Anything that needs a row edited by hand. The tables that matter are append-only on purpose.
- A platform admin needs to be added or removed (done in the database by hand).
