import { BUILT_IN_GENERATORS, type ArtworkStack, type PatternGenerator } from "@/lib/artwork-stack";
import { printScale, type GradedPattern } from "@/lib/production/contract";
import { DEFAULT_SETTINGS, type BuildEnv } from "../layout/context";
import { createLayoutMapper } from "../layout/mapper";
import { NO_SCALE } from "../layout/print-space";
import { EMPTY_RULES } from "../rules";
import { loadBundledFont } from "../text/font";
import { ZONE_TEMPLATES } from "../zones";
import { createTestAssetReader, type TestAsset } from "./assets";
import { TEST_BASE_SIZE, TEST_GRADED_JERSEY } from "./graded";

let fontPromise: ReturnType<typeof loadBundledFont> | undefined;
export const testFont = (): ReturnType<typeof loadBundledFont> => (fontPromise ??= loadBundledFont());

export interface EnvOptions {
  readonly pattern?: GradedPattern;
  readonly baseSize?: string;
  readonly assets?: readonly TestAsset[];
  readonly generators?: readonly PatternGenerator[];
  readonly shrinkLengthPct?: number;
  readonly shrinkWidthPct?: number;
  readonly overrides?: Partial<BuildEnv>;
}

/** A build environment over the test graded jersey, for tests of everything that builds files. */
export async function makeEnv(stack: ArtworkStack, options: EnvOptions = {}): Promise<BuildEnv> {
  const tested = options.shrinkLengthPct !== undefined && options.shrinkWidthPct !== undefined;
  const scale = tested
    ? printScale({
        shrinkLengthPct: { value: options.shrinkLengthPct!, source: "fabric-test", testId: "test-1" },
        shrinkWidthPct: { value: options.shrinkWidthPct!, source: "fabric-test", testId: "test-1" },
      })
    : printScale({ shrinkLengthPct: { value: null, source: "not-set" }, shrinkWidthPct: { value: null, source: "not-set" } });
  return {
    stack,
    colourwayId: stack.colourways[0].id,
    mapper: createLayoutMapper({ pattern: options.pattern ?? TEST_GRADED_JERSEY, baseSize: options.baseSize ?? TEST_BASE_SIZE }),
    zoneTemplates: ZONE_TEMPLATES,
    generators: options.generators ?? BUILT_IN_GENERATORS,
    assets: createTestAssetReader(options.assets ?? []),
    settings: DEFAULT_SETTINGS,
    rules: EMPTY_RULES,
    scale: tested ? { length: scale.length, width: scale.width, note: scale.note } : { ...NO_SCALE, note: scale.note },
    font: await testFont(),
    patternReviewed: false,
    scaleSource: tested ? "fabric test test-1" : null,
    ...options.overrides,
  };
}
