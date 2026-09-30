# Owner questions: launch hardening (step 26)

Nothing here was invented. Each item needs the owner, and some a lawyer.

## Legal pages (A9)

1. Legal name, registered address and company number of the business behind Knitwright.
2. Privacy contact address (the drafts suggest privacy@knitwright.com), and the ICO registration
   number once registered.
3. Does Knitwright offer its service to people in the EU? If so, with no EU establishment, an
   Article 27 representative is needed. Lawyer to confirm. **Answered 2026-09-30: Knitwright is
   offered worldwide.** Built: the privacy notice names an EU representative under Article 27,
   with the name and address still owed (owner: appoint one before sign-up opens), and all three
   drafts ask the lawyer for a wider review of the markets beyond the UK and the EU.
4. Governing law and courts (the draft says England and Wales, to confirm). **Answered
   2026-09-30: England and Wales.** Built: the terms and the data-processing terms say so.
5. Liability cap while the service is free (the draft leaves an amount blank).
6. Breach notification target to customers (the draft suggests 48 hours) and any limits on audits.
7. Supabase project region; Supabase backup period on the chosen plan; Vercel and monitoring log
   retention. These fill the retention section of the privacy notice.
8. Which error monitoring provider, if any, and its region. **Answered 2026-09-30: Sentry, EU
   region.** Built: listed as a processor in Frankfurt, Germany; `.env.example` shows an EU DSN
   (`de.sentry.io`); a DSN outside the EU region is warned about. Sentry's event retention for the
   chosen plan is still owed for the privacy notice (question 7).
9. Lawyer to confirm the transfer mechanism for each US provider (Data Privacy Framework or
   standard contractual clauses with the UK addendum).
10. Confirm that the AI providers are used on paid terms that exclude training on customer data
    (Anthropic, OpenAI, Google Gemini API paid tier), as the drafts say.

## Operations

11. `MONITORING_DSN`: a Sentry (or GlitchTip) project DSN, or a webhook URL. Unset means errors
    go to the Vercel log only. **Provider answered 2026-09-30 (Sentry, EU region);** the DSN of
    the EU project is still owed.
12. Where the spend-ceiling alert should reach you (email, chat), set up in the monitoring service.
13. Storage quota per brand before sign-up opens (security finding S-01), for example 200 files or
    500 MB. **Answered 2026-09-30: 500 MB per brand.** Built: kept by the database
    (`supabase/migrations/20260930040000_storage_quota.sql`, `lib/storage/quota.ts`); S-01 closed.
14. Whether account deletion should ask for a fresh sign-in or an emailed code first (S-08). Needs
    email sending (A4).
