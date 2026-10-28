/**
 * Ways to walk over a whole document. They exist so that tests, and later the exports, can
 * check every value in the document without knowing its shape. A cell is any object that has
 * a `status`.
 */

type Visit = (path: string, value: unknown) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function walk(value: unknown, path: string, visit: Visit): void {
  visit(path, value);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
  else if (isRecord(value)) {
    for (const [key, inner] of Object.entries(value)) walk(inner, path === "" ? key : `${path}.${key}`, visit);
  }
}

interface FoundCell {
  readonly path: string;
  readonly cell: Record<string, unknown>;
}

/** Every cell in a value, in document order. */
export function allCells(root: unknown): readonly FoundCell[] {
  const found: FoundCell[] = [];
  walk(root, "", (path, value) => {
    if (isRecord(value) && "status" in value) found.push({ path, cell: value });
  });
  return found;
}

interface Leaf {
  readonly path: string;
  readonly leaf: string | number;
}

/** Every string and number in a value, except under the paths that match `skip`. */
export function leaves(root: unknown, skip?: RegExp): readonly Leaf[] {
  const found: Leaf[] = [];
  walk(root, "", (path, value) => {
    if (skip?.test(path)) return;
    if (typeof value === "string" || typeof value === "number") found.push({ path, leaf: value });
  });
  return found;
}
