/**
 * Gives back a value that must be there, or throws a sentence that says which fact broke.
 * It exists so that a missing value can never quietly turn into a zero.
 */
export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Sizing broke a rule it depends on: ${what} was missing.`);
  return value;
}
