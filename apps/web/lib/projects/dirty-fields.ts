/**
 * Which fields hold text that was not saved, by name. Only fields with unsaved text are
 * kept. Marking a field as it already is hands back the same record, so the screen does
 * not draw again and a field that reports itself on every draw cannot start a loop.
 */
export type DirtyFields = Readonly<Record<string, true>>;

export const markDirty = (before: DirtyFields, key: string, dirty: boolean): DirtyFields => {
  if ((before[key] === true) === dirty) return before;
  if (dirty) return { ...before, [key]: true };
  return Object.fromEntries(Object.entries(before).filter(([name]) => name !== key)) as DirtyFields;
};

/** True when any field holds text that was not saved. */
export const anyDirty = (fields: DirtyFields): boolean => Object.keys(fields).length > 0;
