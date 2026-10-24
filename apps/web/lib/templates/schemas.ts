import { z } from "zod";

/** What the "Use this template" form sends: the template's id and nothing else. The brand comes from the session. */
export const useTemplateSchema = z.object({
  templateId: z.uuid("Choose a template from the list."),
});
export type UseTemplate = z.output<typeof useTemplateSchema>;

/** Where a person lands in the editor on a new design. */
export const editorAddress = (projectId: string): string => `/studio/${encodeURIComponent(projectId)}`;
