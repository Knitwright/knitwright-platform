import type { SettingDef } from "./types";

/**
 * The registration point for settings other workstreams own. W3-C (lib/media-check) adds its checker thresholds
 * here, as entries in group "checker" with keys such as `checker.colour_delta_max`. Add entries; do not edit
 * registry.ts. Never register a secret.
 */
export const EXTENSION_SETTINGS: readonly SettingDef[] = [];
