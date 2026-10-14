import { BENCHMARK_DOTS, MARKS, jersey } from "@/lib/artwork-stack/fixtures/designs";
import type { GarmentSpec } from "@/lib/garment";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";
import type { OpenProject } from "@/lib/projects/project-reads";
import { createTestAssetReader, type TestAsset } from "../fixtures/assets";
import { testFont } from "../fixtures/env";
import { DEFAULT_SETTINGS } from "../layout/context";
import { EMPTY_RULES } from "../rules";
import type { PrintDeps } from "./serve";

export const projectOf = (spec: GarmentSpec = jersey({ kitPattern: BENCHMARK_DOTS, namesAndNumbers: MARKS }), over: Partial<OpenProject> = {}): OpenProject => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Polka jersey",
  styleNumber: "KW-001",
  season: "SS27",
  garmentType: "team-jersey",
  garmentLabel: "Team jersey",
  currentVersion: 3,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
  versionSavedAt: "2026-10-02T00:00:00Z",
  spec,
  dropped: [],
  ...over,
});

/** Dependencies for the download, with nothing in the database: the defaults, an empty library, and the assets given. */
export const fakeDeps = (over: Partial<PrintDeps> = {}, assets: readonly TestAsset[] = [], project: OpenProject = projectOf()): PrintDeps => ({
  load: async () => project,
  settings: async () => DEFAULT_SETTINGS,
  rules: async () => EMPTY_RULES,
  fabric: async () => null,
  sizeMaps: async () => DEFAULT_SIZE_LABEL_MAPS,
  assets: createTestAssetReader(assets),
  font: testFont,
  ...over,
});
