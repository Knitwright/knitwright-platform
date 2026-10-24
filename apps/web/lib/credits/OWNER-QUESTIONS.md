# Owner questions: credits (plan v4, V6)

Every number below is a placeholder in `lib/credits/settings.ts` and is labelled as one on the credits
page. None of them is a price.

1. **Price of a marketing media set.** Placeholder: 1 credit. What is one set (and what is in a set)?
2. **Price of the full tech pack PDF.** Placeholder: 1 credit. Is a re-download of a changed design
   (new saved version) a new charge, as built, or free within a day?
3. **Price of a pattern file export.** Placeholder: 1 credit. One price for every file, or per file
   type (DXF, PDF) or per size set?
4. **Refund rule.** Built: when a design version is ordered, every credit spent on that version comes
   back, once. Side effect: after ordering, re-downloading those outputs is free. Should it be
   full or partial? Should only outputs made before the order count? Is the order the Store's payment
   or the moment the order is submitted?
5. **Monthly free credits.** Placeholder: 10 per brand each UTC month. How many? Per brand (built) or
   per member? Do unused credits roll over or expire (an `expire` line exists, nothing calls it)? Should
   a small brand and a club get different amounts?
6. **Where credits come from beyond the allowance.** Buying credits is the Store's concern and is not
   built here. Is there any other grant (a promotion, a partner)?
7. **Gating order for wave 2.** Which export is gated first, and what does a brand with no credits see
   (a message, a way to ask for more)?

## Added by wave 2, workstream W2-E (decision 0051)

8. **Print files and pattern files share one price.** Built: the print-file zip and a pattern request both
   spend `pattern_file`, so a version pays once for the two. Should print files have their own price (that
   needs a new output kind and a migration)? Pattern-library DXF downloads belong to a block, not a design
   version, and are not charged.
9. **Photoreal images are charged once per version.** Built: making images for a saved version is charged
   once; making them again for the same version is free of credits (the beta usage caps still apply).
   Should every new set of images cost credits?
10. **Charge before or after the file?** Built: charged before the work starts, and a retry of the same
    version is free, so a failed attempt is never charged twice. Someone who never retries has paid for
    nothing. Should a failure give the credits back?
11. **Switching it on.** Set `CREDITS_ENFORCED=true` once the prices in `lib/credits/settings.ts` are real
    and `syncCreditPrices` has been run. Until then it only logs what would have been spent.
