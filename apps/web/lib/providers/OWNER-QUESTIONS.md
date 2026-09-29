# Owner questions: photoreal images (plan step 14)

1. **Quality.** The plan asks the owner to judge at least three providers on the same ten
   designs. Nothing has been judged. The provisional choice (Gemini `gemini-3.1-flash-image`)
   is on price and terms only; see `docs/data-processing.md`. Two of the four compared were
   excluded on terms, so the comparison needs Gemini and OpenAI keys (A3).
2. **Key (A3).** Set `GEMINI_API_KEY` from a Google Cloud project with billing on. A free-tier
   key lets Google train on and review the designs. Until it is set, the design page says
   "Photoreal images are not set up yet."
3. **Price.** Each request (front and back) reserves $0.14 from the photoreal allowance.
   With the provisional default of $0.50 per user a day, that is three requests a day.
4. **Logo.** The uploaded logo's own pixels are drawn into the flat that is sent to the
   model. The model redraws it; it is not pasted onto the result afterwards. Is a logo that
   the model may soften acceptable for an illustration, or should the logo be pasted on top?
5. **Retention.** Generated images are kept in the brand's storage with no expiry. Should
   old images be deleted after some time?
