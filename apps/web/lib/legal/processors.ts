/**
 * The service providers that handle personal data for Knitwright. One list, used by the privacy
 * notice and the data-processing terms, so the two can never disagree.
 */

type Processor = Readonly<{
  name: string;
  purpose: string;
  data: string;
  location: string;
}>;

export const PROCESSORS: readonly Processor[] = [
  {
    name: "Supabase, Inc.",
    purpose: "Database, sign-in and file storage",
    data: "Account details, brands, designs, uploaded and generated pictures, usage records",
    location: "[owner: the Supabase project region, for example EU (Frankfurt) or UK (London)]",
  },
  {
    name: "Vercel Inc.",
    purpose: "Hosting the website and running its server code",
    data: "Everything sent to the site while it is processed; request logs with network addresses",
    location: "United States, with servers worldwide",
  },
  {
    name: "Anthropic PBC",
    purpose: "Reading text instructions and sketches (AI features)",
    data: "The instruction or picture sent, and the design it applies to",
    location: "United States",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "Reading text instructions and sketches when the first model cannot (AI features)",
    data: "The instruction or picture sent, and the design it applies to",
    location: "United States",
  },
  {
    name: "Google LLC (Gemini API)",
    purpose: "Making photoreal pictures of a design on request (AI features)",
    data: "A description and drawing of the design",
    location: "United States",
  },
  {
    name: "Features & Labels, Inc. (fal.ai)",
    purpose:
      "Making photoreal pictures of a design on request, in place of Google, and reading text instructions and sketches when Anthropic or OpenAI cannot (AI features)",
    data: "The instruction, picture, description or drawing sent, and the design it applies to, which we ask fal not to store",
    location: "United States",
  },
  {
    name: "OpenRouter, Inc. (through fal.ai)",
    purpose: "Passing text instructions and sketches on to Anthropic or OpenAI when fal is used (AI features)",
    data: "The instruction or picture sent, and the design it applies to",
    location: "United States",
  },
  {
    name: "Cloudflare, Inc. (Turnstile)",
    purpose: "Telling people from automated sign-ups",
    data: "Browser and network signals during sign-up, sign-in and password reset",
    location: "United States, with servers worldwide",
  },
  {
    name: "Resend, Inc.",
    purpose: "Sending sign-up, sign-in and password emails",
    data: "Email address and the message",
    location: "United States",
  },
  {
    name: "Functional Software, Inc. (Sentry)",
    purpose: "Recording unexpected errors so they can be fixed",
    data: "Error details, with keys, tokens and email addresses removed before sending",
    location: "European Union (Frankfurt, Germany): Sentry's EU data region",
  },
];

export const processorTable = () => ({
  kind: "table" as const,
  head: ["Provider", "What it does for Knitwright", "Personal data it handles", "Where"],
  rows: PROCESSORS.map((processor) => [processor.name, processor.purpose, processor.data, processor.location]),
});
