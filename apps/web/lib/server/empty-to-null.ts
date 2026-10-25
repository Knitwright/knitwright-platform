/** Turns an empty or blank form string into null, so an optional field left empty means "not set". */
export const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
