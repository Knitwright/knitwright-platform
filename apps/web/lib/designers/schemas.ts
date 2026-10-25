import { z } from "zod";
import { SPORTS, STYLE_IDS } from "@/lib/templates/catalogue";
import { COLOUR_FAMILIES } from "@/lib/templates/colour-family";
import { PAYOUT_STATES } from "./copy";

/** What each designer form sends. The person comes from the session, never from the form. */

export const enrolSchema = z.object({
  displayName: z
    .string({ error: "Give the name to show on your templates." })
    .trim()
    .min(1, "Give the name to show on your templates.")
    .max(80, "Use 80 characters or fewer."),
});

export const newSubmissionSchema = z.object({
  projectId: z.uuid("Choose one of your designs."),
  title: z.string({ error: "Give the template a title." }).trim().min(1, "Give the template a title.").max(120, "Use 120 characters or fewer."),
  sport: z.enum(SPORTS, { error: "Choose a sport." }),
  style: z.enum(STYLE_IDS, { error: "Choose a style." }),
  colourFamily: z.enum(COLOUR_FAMILIES, { error: "Choose the main colour." }),
});
export type NewSubmission = z.output<typeof newSubmissionSchema>;

/** Sending a draft needs the rights statement ticked: the form sends "on" for a ticked box. */
export const sendSubmissionSchema = z.object({
  submissionId: z.uuid("Choose a submission."),
  rightsAttested: z.literal("on", { error: "Tick the box to say you hold the rights to every artwork in the design." }),
});

export const acceptSubmissionSchema = z.object({ submissionId: z.uuid("Choose a submission.") });

export const rejectSubmissionSchema = z.object({
  submissionId: z.uuid("Choose a submission."),
  reason: z.string({ error: "Say why." }).trim().min(1, "Say why.").max(500, "Use 500 characters or fewer."),
});

export const payoutStateSchema = z.object({
  designerId: z.uuid("Choose a designer."),
  state: z.enum(PAYOUT_STATES, { error: "Choose a state." }),
  note: z.string().trim().max(300, "Use 300 characters or fewer.").default(""),
});
