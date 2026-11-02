import type { LifestyleProvider } from "@/lib/media/lifestyle/provider";
import { SCENE_IDS, type SceneId } from "@/lib/media/lifestyle/scenes";
import { selectProviders, type LifestyleEnv } from "@/lib/media/lifestyle/select";
import type { SceneGroup } from "@/lib/mockups";
import type { ShootProvider, ShootRequest } from "./provider";
import { stubShootProvider } from "./stub";

/**
 * THE REAL PROVIDER, WHICH IS AN EXISTING ONE (plan v5 wave 4 preamble: paid generation goes
 * "through the existing `lib/media/lifestyle` adapters; both are stubbed in tests").
 *
 * There is already a family of adapters that puts a locked garment into a scene -- Photoroom, FASHN,
 * Google recontext and try-on, fal (decision 0057) -- each behind its own key, each refusing to be
 * made without one. This workstream adds **no second family**. It adapts its own request onto
 * `LifestyleRequest` and lets `lib/media/lifestyle/select.ts` decide what is configured.
 *
 * The one thing that does not line up is the scene: those adapters take one of four scene ids, and
 * `07` has 20 photographic scenes. So a scene's **group** picks the nearest of the four
 * (`LIFESTYLE_SCENE_OF_GROUP`), the shoot's own prompt is sent as the prompt, and
 * `SCENE_MAPPING_NOTE` says on the record that the adapter was told a coarser scene than the one the
 * person chose. A mapping that is written down and labelled is honest; a fifth adapter family built
 * to avoid writing it down would not be.
 *
 * **Nothing here is called in CI.** `chooseShootProvider` gives the stub unless
 * `MEDIA_SHOOTS_LIVE` is exactly "true" and a lifestyle provider is configured, which is the same
 * pair of conditions L5 uses for paid video (`lib/media/video/board-provider.ts`).
 */

export const SCENE_MAPPING_NOTE =
  "The picture provider takes one of four scene names and 07 has twenty, so the provider was asked for the nearest of the four and the shoot's own words carried the rest.";

/** The nearest of the four lifestyle scene ids for each of `07`'s scene groups. */
export const LIFESTYLE_SCENE_OF_GROUP: Readonly<Record<SceneGroup, SceneId>> = {
  product: "street",
  teamwear: "pitch",
  training: "on_model",
  running: "street",
  combat: "on_model",
  esports: "on_model",
  retail: "on_model",
};

export const lifestyleSceneOf = (group: SceneGroup): SceneId => LIFESTYLE_SCENE_OF_GROUP[group];

/** The group a request's scene belongs to has to come in with it: the adapter never reads a row. */
export interface AdapterAsk {
  readonly group: SceneGroup;
}

/**
 * One of the existing lifestyle providers, as a shoot provider. The garment goes in twice, exactly
 * as `lib/media/lifestyle/generator.ts` sends it: `reference` is the picture the model must keep and
 * `garment` is the same garment to place.
 */
export function shootProviderFrom(provider: LifestyleProvider, ask: AdapterAsk): ShootProvider {
  return {
    name: provider.name,
    costPerImageMicrodollars: provider.costMicrodollars,
    async generate(request: ShootRequest, signal: AbortSignal) {
      const scene = lifestyleSceneOf(ask.group);
      if (!provider.scenes.includes(scene)) {
        return { ok: false, message: `${provider.name} cannot make a ${scene} picture.` };
      }
      try {
        const png = await provider.generate(
          {
            scene,
            prompt: request.prompt,
            seed: request.seed,
            reference: request.garment,
            garment: request.garment,
            modelImage: request.modelPhoto,
          },
          signal,
        );
        return { ok: true, png };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The picture provider refused this shoot." };
      }
    },
  };
}

/** What the environment has to say for a paid shoot to be possible at all. */
export type ShootEnv = LifestyleEnv & Readonly<{ MEDIA_SHOOTS_LIVE?: string | undefined }>;

export interface ProviderChoice {
  readonly provider: ShootProvider;
  /** True when a paid provider was chosen. False for the stub, which calls nothing. */
  readonly live: boolean;
  /** Why the stub is in use, or what was wrong with the configuration. Shown to an admin, not a member. */
  readonly problems: readonly string[];
}

/**
 * The provider in use. The stub unless the owner has turned paid shoots on and a lifestyle provider
 * is configured with its key, so a test, a local run and CI all call nothing.
 */
export function chooseShootProvider(env: ShootEnv, ask: AdapterAsk): ProviderChoice {
  if (env.MEDIA_SHOOTS_LIVE !== "true") {
    return { provider: stubShootProvider(), live: false, problems: ["Paid shoots are off: MEDIA_SHOOTS_LIVE is not \"true\"."] };
  }
  const selection = selectProviders(env);
  const wanted = lifestyleSceneOf(ask.group);
  const found = selection.providers.find((provider) => provider.scenes.includes(wanted)) ?? null;
  if (found === null) {
    return {
      provider: stubShootProvider(),
      live: false,
      problems: [...selection.problems, `No configured picture provider makes a ${wanted} picture.`],
    };
  }
  return { provider: shootProviderFrom(found, ask), live: true, problems: selection.problems };
}

/** The four scene ids, re-exported so a caller need not reach into another workstream's module. */
export const LIFESTYLE_SCENE_IDS: readonly SceneId[] = SCENE_IDS;
