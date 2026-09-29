/** How many opening braces are tried before giving up, so hostile text cannot cost much. */
const MAX_ATTEMPTS = 16;

/** The end of the balanced object that opens at `start`, or -1. Braces inside strings are ignored. */
function objectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * The first JSON object found in a model's text, which may be wrapped in a code fence or
 * prose. Returns undefined when there is none. Never throws.
 */
export function extractJsonObject(text: string): unknown {
  let from = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const start = text.indexOf("{", from);
    if (start === -1) return undefined;
    const end = objectEnd(text, start);
    if (end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as unknown;
      } catch {
        // Not JSON after all, such as a brace in prose. Try the next one.
      }
    }
    from = start + 1;
  }
  return undefined;
}
