import { finding } from "../finding";
import type { ParameterDef } from "../ports";
import type { CheckModule, DesignInput, RuledFinding } from "../registry";
import { ruleIdFor } from "../rules";

type Value = number | string | boolean;

const blocker = (design: DesignInput, code: string, message: string, action: string, ruleId: string | null): RuledFinding => ({
  ...finding({ code, severity: "blocker", article: design.typeId, message, action, whoActs: "owner" }),
  ruleId: ruleId ?? ruleIdFor(code),
});

/** Whether `value` sits on a step counted from the minimum, allowing for floating point. */
const onStep = (value: number, min: number, step: number): boolean => {
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
};

/** The problem with one chosen value, or null when it is inside the approved definition. */
function problemWith(design: DesignInput, key: string, value: Value, def: ParameterDef | undefined): RuledFinding | null {
  const code = design.article?.baseArticleCode ?? "";
  if (def === undefined) {
    return blocker(design, "parameter-unknown", `Base article ${code} has no parameter called "${key}".`, `Remove "${key}" from the design.`, null);
  }
  const expected = def.type === "range" ? "number" : def.type === "enum" ? "string" : "boolean";
  if (typeof value !== expected) {
    return blocker(design, "parameter-wrong-type", `Parameter "${key}" needs a ${expected}.`, `Set "${key}" again from the editor.`, def.ruleId);
  }
  if (def.type === "range") {
    const n = value as number;
    if (n < def.min || n > def.max) {
      return blocker(design, "parameter-out-of-range", `Parameter "${key}" is ${n}, outside the range ${def.min} to ${def.max} the factory makes.`, `Set "${key}" between ${def.min} and ${def.max}.`, def.ruleId);
    }
    if (def.step !== null && def.step > 0 && !onStep(n, def.min, def.step)) {
      return blocker(design, "parameter-off-step", `Parameter "${key}" is ${n}; it moves in steps of ${def.step} from ${def.min}.`, `Pick a value in steps of ${def.step}.`, def.ruleId);
    }
  }
  if (def.type === "enum" && !def.values.includes(value as string)) {
    return blocker(design, "parameter-not-offered", `"${String(value)}" is not one of the choices for "${key}".`, `Pick one of: ${def.values.join(", ")}.`, def.ruleId);
  }
  return null;
}

/**
 * F-0 "article offered" and "parameters in range" (spec decision 5): every chosen parameter is one the base article
 * approves, of the right type and inside its range. Ranges come from the catalogue through `ArticleCatalogue`.
 * A design with no article is told so; a design whose article was not looked up is not judged.
 */
export const parametersInRange: CheckModule = {
  id: "parameters-in-range",
  run: (design) => {
    if (design.article === undefined) return [];
    if (design.article === null) {
      return [
        {
          ...finding({ code: "article-not-set", severity: "warning", article: design.typeId, message: "This design is not on a base article yet, so its structure is not held to a range the factory makes.", action: "Nothing to do now: Knitwright maps every garment to a base article.", whoActs: "owner" }),
          ruleId: ruleIdFor("article-not-set"),
        },
      ];
    }
    const { baseArticleCode, parameters } = design.article;
    if (design.parameterDefs === null || design.parameterDefs === undefined) {
      return [blocker(design, "article-not-offered", `Base article ${baseArticleCode} is not in the catalogue.`, "Start the design from an article in the catalogue.", null)];
    }
    const defs = new Map(design.parameterDefs.map((def) => [def.key, def]));
    return Object.keys(parameters)
      .sort()
      .flatMap((key) => problemWith(design, key, parameters[key] as Value, defs.get(key)) ?? []);
  },
};
