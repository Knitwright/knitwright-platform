import type { ResolvedOption, ResolvedType } from "./registry";

/** Plain names for ids, so sentences a person reads never show a raw id when a label exists. */
export const panelName = (type: ResolvedType, id: string): string =>
  type.panels.find((panel) => panel.id === id)?.label ?? id;

export const pointName = (type: ResolvedType, id: string): string =>
  type.pointsOfMeasure.find((point) => point.id === id)?.label ?? id;

export const choiceName = (option: ResolvedOption, id: string): string =>
  [...option.choices, ...option.notOffered].find((choice) => choice.id === id)?.label ?? id;

/** The label of a place on any panel of the type, or the id when it is unknown. */
export const anchorName = (type: ResolvedType, id: string): string =>
  type.panels.flatMap((panel) => panel.anchors).find((anchor) => anchor.id === id)?.label ?? id;
