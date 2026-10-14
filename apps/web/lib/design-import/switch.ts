/**
 * The switch for the whole feature (owner question P12). Off unless DESIGN_IMPORT is exactly "on", so a
 * missing or mistyped value leaves it off. Every route asks; the screen is never shown while it is off.
 */
export const DESIGN_IMPORT_OFF = "Reading a design from your picture is not switched on yet.";

export const designImportEnabled = (env: Readonly<Record<string, string | undefined>> = process.env): boolean => env.DESIGN_IMPORT === "on";
