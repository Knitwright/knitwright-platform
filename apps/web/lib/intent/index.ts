/**
 * The public surface of the intent library: model output in, one of three outcomes out.
 * It is pure: no React, no Next.js, no database, no network, and no model is called here.
 */
export { OUTCOME_KINDS, isNeverSilent, rejection, type IntentOutcome, type QuestionChoice } from "./outcome";
export { MAX_REPLY_LENGTH, resolveIntent, type IntentInput } from "./resolve";
export { buildModelInput, describeSpec, type ModelInput } from "./model-input";
export { explainChanges } from "./explain";
export { OPTION_KINDS, isConstruction, unstatedChanges } from "./gates";
export { findMentions, isStated, type Mention } from "./mentions";
export { MAX_ACTIONS, MAX_CHOICES, WIRE_ACTION_TYPES, replySchema, wireActionSchema, type Reply, type WireAction } from "./reply-schema";
