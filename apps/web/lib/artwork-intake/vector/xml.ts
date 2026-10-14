import { VECTOR_LIMITS } from "../settings";
import { refuse } from "./refusal";

/**
 * A strict XML reader for the one job of reading an SVG. It is small on purpose: it refuses a document
 * type, entity declarations, processing instructions and every entity but the five XML itself defines,
 * so nothing can expand, include or load anything. It reads text and gives back a tree; it never runs it.
 */

export type XmlElement = {
  /** The name without its prefix, in lower case. */
  readonly name: string;
  /** The prefix, such as `xlink` or `sodipodi`, or "" when there is none. */
  readonly prefix: string;
  readonly attrs: ReadonlyMap<string, string>;
  readonly children: XmlElement[];
  /** The text directly inside the element, all joined. Only `style` text is ever read. */
  text: string;
};

// Sticky patterns read at the cursor without copying the rest of the file.
const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
const ATTR = /([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
const NUMERIC_REF = /&#(x[0-9a-fA-F]{1,6}|[0-9]{1,7});/g;
const PLAIN_ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };

const isTextChar = (code: number): boolean =>
  code === 0x9 || code === 0xa || code === 0xd || (code >= 0x20 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) || (code >= 0x10000 && code <= 0x10ffff);

/** Decodes the five XML entities and number references. Any other `&` is an entity we do not allow. */
export const decodeEntities = (value: string): string => {
  if (!value.includes("&")) return value;
  const numeric = value.replace(NUMERIC_REF, (_whole, code: string) => {
    const point = code.startsWith("x") ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
    if (!isTextChar(point)) return refuse("malformed");
    return String.fromCodePoint(point);
  });
  const named = numeric.replace(/&[A-Za-z][A-Za-z0-9]*;/g, (entity) => PLAIN_ENTITIES[entity] ?? refuse("entities"));
  // What is left is a stray `&`, which is not well formed.
  return named.includes("&") ? refuse("malformed") : named;
};

type Cursor = { at: number };

const skipSpace = (source: string, cursor: Cursor): void => {
  while (cursor.at < source.length && /\s/.test(source[cursor.at])) cursor.at += 1;
};

const readAttributes = (source: string, cursor: Cursor): Map<string, string> => {
  const attrs = new Map<string, string>();
  for (;;) {
    skipSpace(source, cursor);
    if (source.startsWith(">", cursor.at) || source.startsWith("/>", cursor.at)) return attrs;
    ATTR.lastIndex = cursor.at;
    const match = ATTR.exec(source);
    if (!match) return refuse("malformed");
    const value = match[2] ?? match[3] ?? "";
    if (value.length > VECTOR_LIMITS.maxAttributeLength) return refuse("tooComplex");
    if (value.includes("<")) return refuse("malformed");
    if (attrs.has(match[1])) return refuse("malformed");
    attrs.set(match[1], decodeEntities(value));
    cursor.at += match[0].length;
  }
};

const splitName = (qualified: string): { name: string; prefix: string } => {
  const colon = qualified.indexOf(":");
  return colon < 0
    ? { name: qualified.toLowerCase(), prefix: "" }
    : { name: qualified.slice(colon + 1).toLowerCase(), prefix: qualified.slice(0, colon).toLowerCase() };
};

const END_OF = { comment: "-->", cdata: "]]>" } as const;

/** Reads a `<!-- -->` comment or a CDATA section at the cursor, or refuses a document type. */
const readMarkup = (source: string, cursor: Cursor, parent: XmlElement | undefined): void => {
  if (source.startsWith("<!--", cursor.at)) {
    const end = source.indexOf(END_OF.comment, cursor.at + 4);
    if (end < 0) return refuse("malformed");
    cursor.at = end + END_OF.comment.length;
    return;
  }
  if (source.startsWith("<![CDATA[", cursor.at)) {
    const end = source.indexOf(END_OF.cdata, cursor.at + 9);
    if (end < 0 || !parent) return refuse("malformed");
    parent.text += source.slice(cursor.at + 9, end);
    cursor.at = end + END_OF.cdata.length;
    return;
  }
  // <!DOCTYPE and <!ENTITY, or anything else that starts <!
  return refuse("entities");
};

/** Reads the start of an element and pushes it. Returns the element, and whether it is already closed. */
const readStart = (source: string, cursor: Cursor): { element: XmlElement; selfClosed: boolean } => {
  NAME.lastIndex = cursor.at + 1;
  const match = NAME.exec(source);
  if (!match) return refuse("malformed");
  cursor.at += 1 + match[0].length;
  const attrs = readAttributes(source, cursor);
  const selfClosed = source.startsWith("/>", cursor.at);
  cursor.at += selfClosed ? 2 : 1;
  const { name, prefix } = splitName(match[0]);
  return { element: { name, prefix, attrs, children: [], text: "" }, selfClosed };
};

const readEnd = (source: string, cursor: Cursor, open: XmlElement): void => {
  const close = source.indexOf(">", cursor.at);
  if (close < 0) return refuse("malformed");
  const { name, prefix } = splitName(source.slice(cursor.at + 2, close).trim());
  if (name !== open.name || prefix !== open.prefix) return refuse("malformed");
  cursor.at = close + 1;
};

/** Reads an SVG document into a tree, within the node and depth limits. */
export const readXml = (source: string): XmlElement => {
  const cursor: Cursor = { at: source.charCodeAt(0) === 0xfeff ? 1 : 0 };
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  let count = 0;

  while (cursor.at < source.length) {
    const lt = source.indexOf("<", cursor.at);
    const top = stack[stack.length - 1];
    const text = source.slice(cursor.at, lt < 0 ? source.length : lt);
    if (top) top.text += decodeEntities(text);
    else if (text.trim() !== "") return refuse("malformed");
    if (lt < 0) break;
    cursor.at = lt;

    if (source.startsWith("<?", lt)) {
      // Only the XML declaration at the very start is taken. A stylesheet instruction would load a file.
      if (lt > 1 || !/^<\?xml\s/.test(source.slice(lt, lt + 8))) return refuse("externalReference");
      const end = source.indexOf("?>", lt);
      if (end < 0) return refuse("malformed");
      cursor.at = end + 2;
    } else if (source.startsWith("<!", lt)) {
      readMarkup(source, cursor, top);
    } else if (source.startsWith("</", lt)) {
      if (!top) return refuse("malformed");
      readEnd(source, cursor, top);
      stack.pop();
    } else {
      count += 1;
      if (count > VECTOR_LIMITS.maxNodes || stack.length >= VECTOR_LIMITS.maxDepth) return refuse("tooComplex");
      const { element, selfClosed } = readStart(source, cursor);
      if (top) top.children.push(element);
      else if (root) return refuse("malformed");
      else root = element;
      if (!selfClosed) stack.push(element);
    }
  }
  if (stack.length > 0 || !root) return refuse("malformed");
  return root;
};
