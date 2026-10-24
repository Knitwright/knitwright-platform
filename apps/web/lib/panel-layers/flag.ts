/**
 * The prototype route (`/studio/[projectId]/layers`) answers 404 unless NEXT_PUBLIC_PANEL_LAYERS is exactly "on".
 * It is read by name at request time on the server, so the server's environment decides, not the build.
 */
export const panelLayersOn = (env: Readonly<Record<string, string | undefined>> = process.env): boolean => env["NEXT_PUBLIC_PANEL_LAYERS"] === "on";
