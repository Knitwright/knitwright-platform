import type { SpecAction } from "./action-schema";

/**
 * The actions in three groups, so code that handles every action can be split by group and still be checked at compile
 * time: each group handler takes only its own actions, and `unhandledAction` takes only what no group claims (never).
 */

const MEASURED = [
  "set-option",
  "set-measurement",
  "remove-measurement",
  "set-sizing",
  "set-size-measurement",
  "remove-size-measurement",
  "set-tolerance",
  "remove-tolerance",
] as const satisfies readonly SpecAction["type"][];

const MATERIALS = [
  "add-fabric",
  "update-fabric",
  "change-fabric",
  "remove-fabric",
  "assign-fabric",
  "add-colourway",
  "update-colourway",
  "remove-colourway",
  "add-artwork",
  "update-artwork",
  "remove-artwork",
] as const satisfies readonly SpecAction["type"][];

const DETAILS = [
  "set-names-numbers",
  "remove-names-numbers",
  "set-kit-pattern",
  "remove-kit-pattern",
  "set-component",
  "remove-component",
  "set-construction",
  "remove-construction",
  "set-labelling",
  "change-wearer",
  "change-type",
] as const satisfies readonly SpecAction["type"][];

/** Options, measurements, sizing and tolerances. */
export type MeasuredAction = Extract<SpecAction, { type: (typeof MEASURED)[number] }>;
/** Fabrics, colourways and artwork. */
export type MaterialAction = Extract<SpecAction, { type: (typeof MATERIALS)[number] }>;
/** Names and numbers, kit pattern, components, construction, labelling, wearer and type. */
export type DetailAction = Extract<SpecAction, { type: (typeof DETAILS)[number] }>;

const inGroup =
  <T extends SpecAction>(group: readonly string[]) =>
  (action: SpecAction): action is T =>
    group.includes(action.type);

export const isMeasuredAction = inGroup<MeasuredAction>(MEASURED);
export const isMaterialAction = inGroup<MaterialAction>(MATERIALS);
export const isDetailAction = inGroup<DetailAction>(DETAILS);

/**
 * The fallback after every group: it only compiles when no action is left over, so a new action type must be added to a
 * group (and handled there) before the build passes. Never reached at run time while that holds.
 */
export const unhandledAction = <T>(action: never, fallback: T): T => {
  void action;
  return fallback;
};
