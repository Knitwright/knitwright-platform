/** The plain words for each point of measure a pattern gives, in the order a technician reads them. */
export const POINT_LABELS: ReadonlyArray<readonly [id: string, label: string]> = [
  ["chest-width", "Chest width"],
  ["body-length", "Body length"],
  ["shoulder-width", "Shoulder width"],
  ["across-back", "Across the back"],
  ["sleeve-length", "Sleeve length"],
  ["armhole", "Armhole, straight"],
  ["armhole-curve", "Armhole curve, front plus back"],
  ["upper-arm", "Upper arm"],
  ["sleeve-opening", "Sleeve opening"],
  ["cap-height", "Sleeve cap height"],
  ["cap-curve", "Sleeve cap curve"],
  ["cap-ease", "Sleeve cap ease"],
  ["hem-width", "Hem width"],
  ["neck-width", "Neck width"],
  ["front-neck-drop", "Front neck drop"],
  ["back-neck-drop", "Back neck drop"],
  ["neckline-length", "Neckline, all the way round"],
  ["collar-height", "Collar width as cut"],
  ["collar-cut-length", "Collar cut length"],
  ["placket-length", "Placket length"],
  ["placket-width", "Placket width"],
];

const LABELS = new Map(POINT_LABELS);

export const pointLabel = (id: string): string => LABELS.get(id) ?? id;
