import { createFalProvider } from "@/lib/providers/fal";
import { createFashnProvider } from "./adapters/fashn";
import { createGoogleTryOnProvider, createRecontextProvider } from "./adapters/google";
import { createPhotoroomProvider } from "./adapters/photoroom";
import { createFalLifestyleProvider } from "./adapters/fal";
import type { LifestyleProvider } from "./provider";
import { stubLifestyleProvider } from "./stub";

/**
 * Which providers make lifestyle pictures, from the environment. Nothing is chosen by default: with `LIFESTYLE_SCENE_PROVIDER`
 * unset no lifestyle picture is made. A provider whose key is missing is left out and named, never guessed.
 */

/**
 * Read from the process environment: LIFESTYLE_SCENE_PROVIDER, LIFESTYLE_TRYON_PROVIDER, PHOTOROOM_API_KEY, FASHN_API_KEY,
 * FAL_KEY, GOOGLE_VERTEX_ACCESS_TOKEN, GOOGLE_VERTEX_PROJECT, GOOGLE_VERTEX_LOCATION and LIFESTYLE_DAILY_CAP_MICRODOLLARS.
 */
export type LifestyleEnv = Readonly<Record<string, string | undefined>>;

export type Selection = Readonly<{ providers: readonly LifestyleProvider[]; problems: readonly string[] }>;

const google = (env: LifestyleEnv) =>
  env.GOOGLE_VERTEX_ACCESS_TOKEN && env.GOOGLE_VERTEX_PROJECT ? { accessToken: env.GOOGLE_VERTEX_ACCESS_TOKEN, project: env.GOOGLE_VERTEX_PROJECT, location: env.GOOGLE_VERTEX_LOCATION || "us-central1" } : null;

/** The provider called `name`, or the reason it cannot be made. */
export function providerNamed(name: string, env: LifestyleEnv): LifestyleProvider | string {
  const missing = (what: string) => `${name} is chosen but ${what} is not set.`;
  switch (name) {
    case "stub":
      return stubLifestyleProvider();
    case "photoroom":
      return env.PHOTOROOM_API_KEY ? createPhotoroomProvider({ apiKey: env.PHOTOROOM_API_KEY }) : missing("PHOTOROOM_API_KEY");
    case "fashn":
      return env.FASHN_API_KEY ? createFashnProvider({ apiKey: env.FASHN_API_KEY }) : missing("FASHN_API_KEY");
    case "fal":
      return env.FAL_KEY ? createFalLifestyleProvider(createFalProvider({ apiKey: env.FAL_KEY })) : missing("FAL_KEY");
    case "google-recontext": {
      const options = google(env);
      return options ? createRecontextProvider(options) : missing("GOOGLE_VERTEX_ACCESS_TOKEN or GOOGLE_VERTEX_PROJECT");
    }
    case "google-tryon": {
      const options = google(env);
      return options ? createGoogleTryOnProvider(options) : missing("GOOGLE_VERTEX_ACCESS_TOKEN or GOOGLE_VERTEX_PROJECT");
    }
    default:
      return `${name} is not a lifestyle provider.`;
  }
}

/** The try-on provider comes first, so the model scene goes to it when it has a person's picture and falls back to the scene provider when not. */
export function selectProviders(env: LifestyleEnv): Selection {
  const providers: LifestyleProvider[] = [];
  const problems: string[] = [];
  const names = [env.LIFESTYLE_TRYON_PROVIDER, env.LIFESTYLE_SCENE_PROVIDER].filter((name): name is string => !!name);
  for (const name of names) {
    const made = providerNamed(name, env);
    if (typeof made === "string") problems.push(made);
    else providers.push(made);
  }
  return { providers, problems };
}
