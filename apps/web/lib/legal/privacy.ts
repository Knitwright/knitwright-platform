import { AUSTRALIA_REVIEW, type LegalDocument } from "./model";
import { processorTable } from "./processors";

export const PRIVACY: LegalDocument = {
  slug: "privacy",
  title: "Privacy notice",
  summary:
    "This notice explains what personal data Knitwright collects, why, who it is shared with, how long it is kept and the rights you have. It is written for the UK GDPR, the Data Protection Act 2018 and the EU GDPR, and, for people in Australia, the Privacy Act 1988 and the Australian Privacy Principles.",
  updated: "2026-10-11",
  status: "draft",
  sections: [
    {
      heading: "Who is responsible",
      blocks: [
        {
          kind: "p",
          text: "[owner: legal name of the business], [owner: registered address] is the controller of the personal data described here. Contact us about privacy at [owner: privacy contact address, for example privacy@knitwright.com]. [owner: UK ICO registration number, once registered.]",
        },
        {
          kind: "p",
          text: "Knitwright is offered worldwide, including to people in the European Union, and has no establishment in the EU. Our representative in the European Union under Article 27 of the EU GDPR is [owner: name and address of the EU representative, to be appointed before sign-up opens]. People in the EU, and EU data protection authorities, may contact the representative about anything to do with the processing of personal data, in addition to or instead of us.",
        },
        {
          kind: "p",
          text: "[lawyer: Knitwright is offered worldwide (owner decision, 2026-09-30). Review this text for the laws of the main markets beyond the UK and the EU, for example the United States (including state privacy laws such as California's), Canada, Australia and Brazil, and for consumer, sanctions and export rules.]",
        },
        {
          kind: "p",
          text: "Where a business uses Knitwright to hold personal data about other people (for example a name in a tech pack), we act for that business as its processor under the data-processing terms.",
        },
      ],
    },
    {
      heading: "What we collect",
      blocks: [
        {
          kind: "table",
          head: ["Data", "Where it comes from"],
          rows: [
            ["Email address; a password, stored only as a salted hash by our sign-in provider", "You, when you sign up"],
            ["Your Google account id, name and email, if you sign in with Google", "Google, with your permission"],
            ["Brand names, designs, every saved version, notes and text you enter", "You"],
            ["Pictures you upload (logos, artwork, sketches, photos). We re-encode them, which removes location and camera details", "You"],
            ["Your confirmation that you may use a logo or artwork you upload: who gave it, when, and the words shown", "You, when you upload"],
            ["Your choices about marketing email: each yes or no, when, where you made it (sign-up, Settings or an unsubscribe link) and the words shown", "You"],
            ["Pictures generated for you, and the descriptions used to make them", "Knitwright and its AI providers"],
            ["Records of tech pack downloads: which design, version, format and when", "Knitwright, as you use it"],
            ["Usage and cost records for AI features", "Knitwright, as you use it"],
            ["Network address and browser details, used for rate limits, the bot check and security logs", "Your browser"],
          ],
        },
        {
          kind: "p",
          text: "We do not ask for special category data, and please do not put any into Knitwright.",
        },
      ],
    },
    {
      heading: "Why we use it, and on what legal basis",
      blocks: [
        {
          kind: "table",
          head: ["Purpose", "Legal basis"],
          rows: [
            ["Creating and running your account, storing your designs, making tech packs and pictures", "Contract (Article 6(1)(b))"],
            ["Sending sign-in, confirmation and password emails", "Contract"],
            ["Keeping Knitwright secure: rate limits, the bot check, keeping brands apart, investigating misuse", "Legitimate interests (Article 6(1)(f)): protecting the service and its users"],
            ["Recording errors so we can fix them", "Legitimate interests: a working service"],
            ["Usage allowances and cost limits for AI features", "Contract and legitimate interests: preventing abuse and runaway costs"],
            ["Keeping records the law requires, and dealing with legal claims", "Legal obligation (Article 6(1)(c)) and legitimate interests"],
            ["Sending marketing email about new templates, season deadlines and offers, only if you said yes", "Consent (Article 6(1)(a)); in Australia, consent under the Spam Act 2003"],
            ["Keeping a record of your marketing choices and of your logo confirmations", "Legal obligation and legitimate interests: showing that we had consent, and that you confirmed your rights"],
          ],
        },
        {
          kind: "p",
          text: "We do not sell personal data, show advertising, or use your content to train AI models. AI features suggest changes that you can accept or reject; they make no decision that has a legal or similarly significant effect on you.",
        },
      ],
    },
    {
      heading: "Marketing email",
      blocks: [
        {
          kind: "p",
          text: "We send marketing email (new templates, season deadlines, offers) only if you tick the box that says so, at sign-up or in Settings. The box is never ticked for you. We keep a record of each choice you make: yes or no, when, where and the exact words shown. You can change your choice in Settings at any time.",
        },
        {
          kind: "list",
          items: [
            "Every marketing email identifies Knitwright and how to contact us, as Australia's Spam Act 2003 requires, and has a working unsubscribe link.",
            "The unsubscribe link works without signing in. We stop marketing email as soon as you use it, and in any case within 5 working days.",
            "Emails about a design or order you started (its price, its deadline) are service messages about that design or order. They also carry an unsubscribe link.",
            "Emails you need to use your account, such as sign-in and confirmation links, are not marketing and are always sent.",
            "We never email people you invite to see or comment on a design, unless they sign up and opt in themselves.",
            "We do not use the designs, logos or pictures you upload for anything else, such as advertising or other customers, without your written permission.",
          ],
        },
      ],
    },
    {
      heading: "Who we share it with",
      blocks: [
        {
          kind: "p",
          text: "We share personal data only with the providers below, who process it for us under written data-processing terms, and where the law requires us to. Our AI providers are used through their paid business services, whose terms say that data sent to them is not used to train their models.",
        },
        processorTable(),
      ],
    },
    {
      heading: "International transfers",
      blocks: [
        {
          kind: "p",
          text: "Knitwright is used from many countries, and its providers are in the places listed above. Some providers are in the United States or process data there. Where personal data leaves the UK or the European Economic Area, the transfer is covered by an adequacy decision (including the UK Extension to the EU-US Data Privacy Framework, where the provider is certified) or by the standard contractual clauses and the UK International Data Transfer Addendum in the provider's data-processing terms. [lawyer: confirm the mechanism for each provider.]",
        },
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        {
          kind: "list",
          items: [
            "Account, brands, designs, pictures and download records: until you delete them or your account. Deleting a design or an account removes it from the database and file storage at once.",
            "Copies in our providers' backups: until overwritten, [owner: the Supabase backup period for the chosen plan, for example up to 7 days].",
            "Rate-limit counters: minutes to an hour.",
            "Server logs: [owner: the log retention of the Vercel plan, for example 1 to 30 days]. Error reports in Sentry: [owner: the event retention of the Sentry plan], then deleted.",
            "The address on the early-access list: until you register or ask us to remove it; it is removed when your account is deleted.",
          ],
        },
      ],
    },
    {
      heading: "Cookies",
      blocks: [
        {
          kind: "p",
          text: "Knitwright uses only cookies that it needs to work: sign-in session cookies, a cookie that remembers which brand you are working in, and the cookies the bot check sets during sign-up and sign-in. There are no analytics or advertising cookies, so we do not ask for cookie consent.",
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        {
          kind: "p",
          text: "You have the right to access your personal data, to have it corrected, to have it erased, to restrict or object to its use, and to receive it in a portable form. You can delete designs and your whole account yourself, and download any tech pack as PDF, Excel or SVG. For anything else, write to the privacy contact above; we reply within one month.",
        },
        {
          kind: "p",
          text: "You can complain to the UK Information Commissioner's Office (ico.org.uk) or, in the EU, to the data protection authority where you live or work. We would like the chance to help first.",
        },
      ],
    },
    {
      heading: "People in Australia: the Privacy Act 1988",
      blocks: [
        {
          kind: "p",
          text: "For people in Australia, we handle personal information in line with the Privacy Act 1988 and the Australian Privacy Principles. [owner and Australian adviser: whether the Privacy Act applies to Knitwright at its size (the small business exemption turns on annual turnover); this notice follows the Australian Privacy Principles either way.]",
        },
        {
          kind: "list",
          items: [
            "What we collect and why: the information in the sections above, collected from you or, for Google sign-in, from Google with your permission. We collect only what we need to provide Knitwright, make your garments and, if you said yes, send you marketing email. You can use Knitwright without telling us anything beyond your email address.",
            "Where it is stored: Knitwright is hosted outside Australia. Our providers, and the countries where they hold or process data, are listed under \"Who we share it with\". We disclose personal information to them overseas only to provide Knitwright, under contracts that require them to protect it. [owner: the Supabase project region.]",
            "Access and correction: you can see and correct most of your information in Knitwright yourself. Ask the privacy contact above for a copy of the rest, or to correct it. We reply within 30 days and do not charge for asking.",
            "Deleting it: you can delete your designs and your whole account in Settings.",
            "Complaints: write to the privacy contact above first; we will reply within 30 days. If you are not satisfied, you can complain to the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au.",
          ],
        },
        { kind: "p", text: AUSTRALIA_REVIEW },
      ],
    },
    {
      heading: "Security",
      blocks: [
        {
          kind: "p",
          text: "Data is encrypted in transit and at rest by our providers. Each brand's data is kept apart by database rules that are tested automatically. Access to the full database is limited to the server. We will tell you and the regulator about a personal data breach where the law requires.",
        },
      ],
    },
    {
      heading: "Changes",
      blocks: [
        {
          kind: "p",
          text: "We will post changes to this notice here and, for significant changes, tell you by email or in the app.",
        },
      ],
    },
  ],
};
