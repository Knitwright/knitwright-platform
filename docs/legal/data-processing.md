# Data-processing terms

> **DRAFT. Not in force. The owner and a qualified lawyer must approve this text before Knitwright opens to the public (owner action A9). Text in [square brackets] is for the owner to fill in.**

Last updated: 2026-09-30

These terms apply where a business (the "customer") uses Knitwright to process personal data about other people, and Knitwright processes that data for the customer. They are the contract Article 28 of the UK GDPR and the EU GDPR requires, and form part of the terms of use.

## 1. Roles

For personal data inside a customer's brand (designs, tech packs, notes, uploaded pictures and the names of people who made or approved them), the customer is the controller and Knitwright is its processor. For account and security data described in the privacy notice, Knitwright is the controller.

## 2. Details of the processing

| Item | Detail |
|---|---|
| Subject matter | Providing Knitwright: storing designs, making drawings, tech packs and pictures, and the AI features the customer uses |
| Duration | While the customer's account exists, then until deletion as set out below |
| Nature and purpose | Storage, retrieval, display, transformation into documents and pictures, transmission to the sub-processors listed below |
| Types of personal data | Names, job titles, email addresses and any other personal data the customer puts in designs, notes or pictures |
| Data subjects | The customer's staff, contractors, suppliers and other people named or shown in its content |

## 3. Knitwright's obligations

Knitwright will:

- process the personal data only on the customer's documented instructions, which are these terms and the customer's use of Knitwright, unless the law requires otherwise, in which case it will tell the customer first unless the law forbids that;
- ensure that everyone authorised to process the data is bound by confidentiality;
- take the security measures in section 5;
- use sub-processors only as set out in section 6;
- help the customer, taking into account the nature of the processing, to answer requests from people exercising their rights, mostly through the self-service tools in Knitwright (editing, exporting and deleting);
- help the customer with security, breach notification, impact assessments and consultation with regulators, as far as the information available to Knitwright allows;
- at the end of the service, delete the personal data (the customer can export its tech packs first and can delete its account at any time), unless the law requires it to be kept;
- make available the information needed to show it meets these obligations, and allow and contribute to audits by the customer or an auditor it appoints, on reasonable notice and at the customer's cost, [owner and lawyer: limits on audits];
- tell the customer at once if it believes an instruction breaks data protection law.

## 4. Personal data breaches

Knitwright will tell the customer without undue delay, and aims to do so within [owner and lawyer: 48 hours], after becoming aware of a personal data breach affecting the customer's data, with the information the customer needs to meet its own duties to report it.

## 5. Security measures

- Each brand's data is separated by row-level security in the database and by per-brand folders in file storage; an automated test suite checks that one brand cannot read another's designs, files or pictures.
- Browsers cannot write to the database or to file storage directly. Every write goes through server code that checks the user's session and brand membership.
- Every server entry point checks its input, the session and a rate limit. The full-access database key is held only by the server.
- Uploaded pictures are checked by their content, re-encoded and stripped of embedded metadata.
- Data is encrypted in transit (TLS) and at rest by the hosting and database providers.
- Keys, tokens and email addresses are removed from logs and error reports.
- Deleting a design or an account removes its records and stored files.

## 6. Sub-processors

The customer gives general authorisation for Knitwright to use the sub-processors below. Knitwright will give at least 30 days' notice of a new or replacement sub-processor by email or in the app, and the customer may object on reasonable grounds; if the objection cannot be resolved, the customer may delete its account. Knitwright imposes data protection obligations on each sub-processor equivalent to these terms, and remains responsible for them.

| Provider | What it does for Knitwright | Personal data it handles | Where |
|---|---|---|---|
| Supabase, Inc. | Database, sign-in and file storage | Account details, brands, designs, uploaded and generated pictures, usage records | [owner: the Supabase project region, for example EU (Frankfurt) or UK (London)] |
| Vercel Inc. | Hosting the website and running its server code | Everything sent to the site while it is processed; request logs with network addresses | United States, with servers worldwide |
| Anthropic PBC | Reading text instructions and sketches (AI features) | The instruction or picture sent, and the design it applies to | United States |
| OpenAI, L.L.C. | Reading text instructions and sketches when the first model cannot (AI features) | The instruction or picture sent, and the design it applies to | United States |
| Google LLC (Gemini API) | Making photoreal pictures of a design on request (AI features) | A description and drawing of the design | United States |
| Features & Labels, Inc. (fal.ai) | Making photoreal pictures of a design on request, in place of Google (AI features) | A description and drawing of the design, which we ask fal not to store | United States |
| Cloudflare, Inc. (Turnstile) | Telling people from automated sign-ups | Browser and network signals during sign-up, sign-in and password reset | United States, with servers worldwide |
| Resend, Inc. | Sending sign-up, sign-in and password emails | Email address and the message | United States |
| Functional Software, Inc. (Sentry) | Recording unexpected errors so they can be fixed | Error details, with keys, tokens and email addresses removed before sending | European Union (Frankfurt, Germany): Sentry's EU data region |

## 7. International transfers

Where a sub-processor processes personal data outside the UK or the European Economic Area, the transfer relies on an adequacy decision or on the standard contractual clauses and the UK International Data Transfer Addendum in that sub-processor's terms. [lawyer: confirm, and add the clauses between Knitwright and the customer if the customer is outside the UK.]

## 8. Law

These terms are governed by the law of England and Wales, as the terms of use are, unless data protection law requires the law of another country to apply to them.

[lawyer: Knitwright is offered worldwide (owner decision, 2026-09-30). Review this text for the laws of the main markets beyond the UK and the EU, for example the United States (including state privacy laws such as California's), Canada, Australia and Brazil, and for consumer, sanctions and export rules.] [lawyer: also say whether customers outside the UK and the EU need further clauses.]

## 9. Order of precedence

If these terms conflict with the terms of use on the processing of personal data, these terms prevail.
