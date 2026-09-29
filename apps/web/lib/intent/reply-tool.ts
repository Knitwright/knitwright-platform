import { z } from "zod";
import { MAX_ACTIONS, MAX_CHOICES, wireActionSchema } from "./reply-schema";

/**
 * The reply contract as a tool a model calls. Text replies and image readings use the same
 * tool (plan step 13, task 1), and whatever the model puts in it is still parsed by
 * `resolveIntent`: the schema helps the model, it does not make the reply trusted.
 */

export const REPLY_TOOL_NAME = "reply";

export const REPLY_TOOL_DESCRIPTION =
  "Give your answer about the garment design. Call this exactly once. Use kind \"changes\" with the list of actions " +
  "to make, kind \"question\" with 2 to 5 choices (each with the actions it would make) and the index of the " +
  "recommended choice, or kind \"rejection\" with a short plain reason when the request cannot be done or is not " +
  "about the garment. Only ids from the instructions are accepted.";

function actionItemSchema(): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(wireActionSchema, { io: "input", unrepresentable: "any" }) };
  delete schema.$schema;
  return schema;
}

/** The JSON Schema of the reply tool's input. */
export function replyToolSchema(): Record<string, unknown> {
  const action = actionItemSchema();
  const actions = { type: "array", items: action, maxItems: MAX_ACTIONS };
  return {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["changes", "question", "rejection"] },
      actions,
      question: { type: "string", maxLength: 400 },
      choices: {
        type: "array",
        minItems: 2,
        maxItems: MAX_CHOICES,
        items: {
          type: "object",
          properties: { label: { type: "string", maxLength: 80 }, actions },
          required: ["label", "actions"],
          additionalProperties: false,
        },
      },
      recommended: { type: "integer", minimum: 0 },
      reason: { type: "string", maxLength: 400 },
    },
    required: ["kind"],
    additionalProperties: false,
  };
}
