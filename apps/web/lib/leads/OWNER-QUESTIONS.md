# Owner questions: the lead engine (decision 0024)

1. **Who is a platform admin?** Nobody is yet. A platform admin sees every brand on
   `/admin/leads`. Add one by hand in the Supabase SQL editor, after that person has an account:

   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

   Remove one with `delete from public.platform_admins where user_id = ...`. The app never adds
   one, not even from `OWNER_EMAIL`: a row that grants access to every brand should be a step
   you take on purpose. Say if you want `OWNER_EMAIL` made an admin at sign-up instead.

2. **TODO: email for a new quote request (owner action A4).** No mail sender exists yet. Today a
   new request writes one info line to the server log ("New quote request ...", no personal
   details) and waits on `/admin/leads`. Once Resend is set up, which address should be told,
   and should the person who asked get a copy? The place to add it is `lib/leads/notify.ts`.

3. **Lead score points.** Built as the guide gives them, in `LEAD_POINTS` in `lib/leads/score.ts`.
   Two are read differently until the features exist:
   - "Quote viewed twice or more" counts **quote requests** (there are no priced quotes to view).
   - "Shared with others" is a hook that gives nothing until committee sharing (another branch)
     is joined in; "design edited 3+ times" counts saved changes after the first version.
   - "Paid credits or sample" is a hook that gives nothing: neither is built.
   Change any number in that one constant.

4. **Which Australian organisations go to the partner?** The guide says "any Australian club with
   a score of 60+". Built: organisation type **club** only. Schools, gyms and academies in
   Australia stay with Knitwright unless you set the owner. Should schools and academies go to the
   partner too?

5. **Privacy notice.** Organisation type, country, state and quote requests (quantity, date, sizes,
   message) are new data. The privacy notice and data-processing pages should name them and the
   purpose (making and quoting kit). The legal wording is yours (A9).

6. **Quantity cap.** A request may ask for 1 to 1,000,000 pieces. Is a smaller cap wanted?
