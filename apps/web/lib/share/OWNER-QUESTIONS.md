# Owner questions: share links, comments and votes (decision 0026)

Nothing here blocks sharing. Each answer may change a rule in `lib/share`.

1. **Asking a visitor for their email, with consent.** Now a visitor gives a name only. No email
   address is asked and nobody is ever emailed (guide p.10: never email invitees unless they
   sign up and opt in themselves). Later the form could offer an optional email field with an
   unticked "Send me news about this kit" box, stored with the consent record that the consent
   work (decision 0025) keeps. Do you want that, and what would the message say?
2. **What a committee sees.** Now: the design name, the brand name, the front and back drawings
   (no measurement callouts), each colourway with its panel colours and a front drawing, and each
   fabric with its composition. Not shown: measurements, construction, labels, components, notes,
   files, other versions, the style number and the season. Should the price (when instant price
   exists) or the 3D view be added?
3. **Copying a link later.** The token is stored only as a hash, so a link can be copied only
   when it is made. To send it again, a member makes a new link. Is that acceptable, or should a
   link be shown again (which means keeping the token, encrypted)?
4. **Limits.** A link lasts 7, 30 or 90 days (30 unless chosen). A design may have 20 links that
   still work. One link takes answers from at most 300 browsers, and 60 answers in 10 minutes. A
   name has up to 60 characters, a comment up to 1000. Are these right for a club committee?
5. **One answer per browser.** A browser's second answer replaces its first (new vote, new
   comment). Someone using two browsers counts twice; the tally is a guide, not a ballot. Is that
   enough, or should a vote need a name that is unique per link?
6. **Answers after a link ends.** Revoked and expired links keep their answers on the design page
   until the design is deleted. Should old answers be removed after some time?
7. **Privacy notice.** Visitors' names, comments and votes are personal data held for the brand.
   The privacy notice (decision 0023, A9 legal review) should say so; the wording is for the
   lawyer.
8. **The secret.** Share pages check the bot check themselves, so the deploy needs
   `TURNSTILE_SECRET_KEY` set to the same secret Supabase Auth uses. Until it is set, share pages
   show the design but refuse answers.

## Added by plan v5 Y8 (invites and link access, decision 0081)

9. **Commenting through an invite.** A Can comment invite opens the design read-only today: the
   answers table hangs off a link, not an invite, so an invited person is shown the design and no
   answer box rather than a box that would refuse them. Should an invite be able to vote and comment
   in its own right, counted in the same tally?
10. **Can edit.** An edit invite is recorded and the email says the reader needs a Knitwright
    account. What happens when they sign in: do they join the brand workspace, or does the design
    get a guest editor who sees that design alone?
11. **The email provider and the sending address.** Nothing is emailed until
    `SHARE_EMAIL_PROVIDER`, `SHARE_EMAIL_KEY` and `SHARE_EMAIL_FROM` are all set; the adapter
    written is Resend's HTTP API. Which provider, which address, and what should the subject line
    say?
12. **How long an invite lasts.** 7, 30 or 90 days, 30 unless chosen, and a design may have 50 open
    invites. The same numbers as a share link. Are they right for a committee and a factory?
