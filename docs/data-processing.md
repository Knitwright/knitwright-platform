# Data processing: photoreal image providers

Status: **provisional**. The owner has not judged image quality (plan step 14, task 1) and
no API keys exist yet (owner action A3). The choice below is made on price and terms only.
Checked: 2026-09-29.

## What is sent

For each request the user makes, per view (front and back):

- a PNG of the flat drawing of the design, 1024 px, with the brand's uploaded logo drawn in;
- a text prompt built from the design (garment type, options, colour names, fabric, artwork
  text). No names of people, emails, brand names or ids are sent.

Designs are confidential and unreleased, so any provider whose terms allow training on
customer inputs or outputs is excluded (plan step 14, task 1).

## Comparison

| Provider and model | Price per image, about 1K | Trains on customer data? | Retention | Image reference input |
|---|---|---|---|---|
| **Google Gemini API**, `gemini-3.1-flash-image` (paid tier) | $0.067 (Flash Lite $0.0336; 3 Pro $0.134) | **No, on the paid tier.** Free tier: yes, with human review | Paid: kept "for a limited period" for abuse detection. The Interactions API stores by default (55 days paid) unless `store:false` | Yes, up to 14 images, inline base64 |
| **OpenAI**, `gpt-image-2`, `/v1/images/edits` | Token-priced; about $0.053 at medium quality, 1024² (third-party estimate, not verified on openai.com) | **No** unless the customer opts in | 30-day abuse logs; Zero Data Retention possible on approval | Yes, up to 16 images |
| **fal.ai**, `fal-ai/nano-banana-2/edit` (same Google model, resold) | $0.08 | **Not ruled out.** The terms give no "no training" promise; de-identified usage data may be used to develop AI models | Payloads kept 30 days by default (a header turns it off) | Yes, up to 14 image URLs |
| **Black Forest Labs**, FLUX Kontext / FLUX.2 API | About $0.04 (Kontext Pro); FLUX.2 $0.014 to $0.07 | **Yes.** Perpetual licence to use input and output to improve and develop products | Not stated | Not verified |

Excluded: Black Forest Labs (terms allow training). fal.ai was excluded on 2026-09-29 because
its terms do not rule training out; the owner chose it on 2026-10-13 (see "fal.ai" below).

## Provisional choice

**Google Gemini API, paid tier, `gemini-3.1-flash-image`**, called directly over HTTPS
(`lib/providers/gemini.ts`). Reasons: the paid-tier terms say prompts and responses are not
used to improve Google's products; it is cheaper than the same model through fal; it takes
the flat as a reference image. OpenAI `gpt-image-2` is the close alternative with the same
terms position; switching means one new file in `lib/providers`.

### fal.ai (owner's choice, 2026-10-13)

The owner chose fal.ai's resale of the same Google model, `fal-ai/nano-banana-2/edit`, at $0.08
an image at 1K (`lib/providers/fal.ts`, key `FAL_KEY`). Google directly stays available
(`GEMINI_API_KEY`); `IMAGE_PROVIDER` picks one when both keys are set. The photoreal allowance
now reserves $0.08 an image, the dearer of the two.

What each call asks of fal, to narrow the gap in its terms:

- `X-Fal-Store-IO: 0`: fal does not store the request or the answer (otherwise 30 days).
- `sync_mode: true`: the picture comes back inside the answer and is not kept in the request
  history.
- `X-Fal-Object-Lifecycle-Preference` with a 600-second expiry, for any file fal still writes
  to its file host.
- A picture is only ever fetched back from fal's file host (`*.fal.media`), never from another
  address an answer names.

**Text models through fal (2026-10-13).** With `FAL_KEY` set, a call to Anthropic or OpenAI
that fails (for example when the account's credit has run out) is sent once more to the same
model through fal's OpenRouter endpoint, `openrouter/router/openai/v1/chat/completions`
(`lib/providers/fal-text.ts`). With no Anthropic or OpenAI key, fal is used alone. The request
carries `X-Fal-Store-IO: 0`. A live test showed the price equal to Anthropic's own. The design
and instruction then pass through fal and OpenRouter as well as the model's vendor; both are
listed as processors.

What remains: fal's terms still do not promise that de-identified data is not used to develop
models. fal is listed as a processor in the privacy notice and the data-processing terms. The
lawyer reviewing them should see this paragraph.

Conditions of use:

- The key (`GEMINI_API_KEY`) must belong to a Google Cloud project **with billing on**. A
  free-tier key lets Google use and review what is sent.
- The estimated cost reserved per request (front and back) is $0.14
  (`lib/images/cost.ts`), from the photoreal allowance (decision record 0012).
- `gemini-2.5-flash-image` is not used: Google shuts it down on 2 October 2026.

What the owner still decides: quality on the same ten designs across at least the two
remaining providers (Gemini, OpenAI), and whether the price is acceptable. See
`apps/web/lib/providers/OWNER-QUESTIONS.md`.

## Sources

- Gemini API terms, paid and unpaid data use: https://ai.google.dev/gemini-api/terms (last modified 2026-04-28)
- Gemini prices and the 2.5 Flash Image shutdown: https://ai.google.dev/gemini-api/docs/pricing
- Gemini image editing, model ids, reference limits: https://ai.google.dev/gemini-api/docs/image-generation
- Gemini generateContent image example: https://ai.google.dev/gemini-api/docs/generate-content/image-generation
- Interactions API retention (`store`): https://ai.google.dev/gemini-api/docs/interactions-overview
- OpenAI data use and retention: https://developers.openai.com/api/docs/guides/your-data
- OpenAI image edits: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI gpt-image-2: https://developers.openai.com/api/docs/models/gpt-image-2
- gpt-image-2 per-image estimates (third party): https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing
- fal nano-banana-2 edit price and inputs: https://fal.ai/models/fal-ai/nano-banana-2/edit
- fal terms and data processing addendum: https://fal.ai/terms, https://fal.ai/legal/data-processing-addendum
- fal payload retention: https://fal.ai/docs/documentation/model-apis/media-expiration
- Black Forest Labs API terms: https://bfl.ai/legal/flux-api-service-terms (updated 2026-08-04)
- Black Forest Labs prices: https://docs.bfl.ai/quick_start/pricing

Not verified: the exact image-size setting on Gemini's `generateContent` endpoint (the app
asks for a 1:1 aspect ratio only); OpenAI's own per-image price; Replicate and Stability AI
were not compared.
