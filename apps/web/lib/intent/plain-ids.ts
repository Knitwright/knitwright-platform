import { listTypes } from "@/lib/garment";

/**
 * A model sees the registry's ids, and sometimes writes them in its question or reason, such
 * as "collar none/band-collar". A person never sees an id: each one a model wrote is turned
 * back into the label the screens use. Plain words that happen to be ids, such as "none" on
 * its own, are left alone, since only an id beside its option or with a hyphen is certainly one.
 */

interface OptionWords {
  readonly label: string;
  readonly choices: ReadonlyMap<string, string>;
}

function tables(): { options: ReadonlyMap<string, OptionWords>; hyphenated: ReadonlyMap<string, string> } {
  const options = new Map<string, { label: string; choices: Map<string, string> }>();
  const hyphenated = new Map<string, string>();
  const name = (id: string, label: string) => {
    if (id.includes("-") && !hyphenated.has(id)) hyphenated.set(id, label);
  };
  for (const type of listTypes()) {
    name(type.id, type.label);
    for (const option of type.options) {
      const entry = options.get(option.id) ?? { label: option.label, choices: new Map<string, string>() };
      for (const choice of [...option.choices, ...option.notOffered]) {
        if (!entry.choices.has(choice.id)) entry.choices.set(choice.id, choice.label);
        name(choice.id, choice.label);
      }
      options.set(option.id, entry);
      name(option.id, option.label);
    }
    for (const panel of type.panels) name(panel.id, panel.label);
    for (const point of type.pointsOfMeasure) name(point.id, point.label);
  }
  return { options, hyphenated };
}

let cached: ReturnType<typeof tables> | undefined;
const known = (): ReturnType<typeof tables> => (cached ??= tables());

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TOKEN = String.raw`["'\x60]?[a-z][a-z0-9-]*["'\x60]?`;
const JOIN = String.raw`\s*(?:\/|\||,|\bor\b)\s*`;
const unquote = (token: string): string => token.replace(/["'`]/g, "").toLowerCase();

/** "collar none/band-collar" becomes "No collar or Band collar", when every word is a choice of it. */
function optionPhrases(text: string): string {
  const { options } = known();
  const ids = [...options.keys()].sort((a, b) => b.length - a.length).map(escape);
  const pattern = new RegExp(String.raw`\b(${ids.join("|")})\b\s*(?:=|:)?\s*(${TOKEN}(?:${JOIN}${TOKEN})*)`, "gi");
  return text.replace(pattern, (whole: string, optionId: string, list: string) => {
    const option = options.get(optionId.toLowerCase());
    const tokens = list.split(new RegExp(JOIN, "i")).map(unquote);
    const labels = tokens.map((token) => option?.choices.get(token));
    if (labels.length === 0 || labels.some((label) => label === undefined)) return whole;
    return labels.join(" or ");
  });
}

/** The words with every id a model wrote replaced by its label. */
export function plainIds(text: string): string {
  const { hyphenated } = known();
  return optionPhrases(text).replace(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/gi, (word) => hyphenated.get(word.toLowerCase()) ?? word);
}
