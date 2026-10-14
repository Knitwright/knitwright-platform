import { ARTWORK_LIMITS } from "../limits";
import type { Budget } from "./budget";
import { refuse, REFUSALS } from "./refuse";

/**
 * A strict reader for the XML of an SVG. It builds a small tree and nothing else: no entity is ever
 * expanded, no document type is read, and nothing is fetched. Whatever could hold or run code, or reach
 * outside the file, is refused here before the tree reaches the part that understands drawings.
 */

export type XmlElement = {
  /** The name without any prefix. */
  readonly name: string;
  readonly prefix: string | null;
  /** Attributes by their name without prefix; `xlink:href` is `href`. Editor attributes with other prefixes are dropped. */
  readonly attrs: Record<string, string>;
  readonly children: XmlElement[];
  text: string;
};

const LIMITS = ARTWORK_LIMITS.vector;
const MAX_ATTRIBUTES = 80;
const MAX_TEXT = 256 * 1024;

const SCRIPT_NAMES = new Set(["script", "handler", "listener"]);
const EMBED_NAMES = new Set(["iframe", "embed", "object", "applet", "audio", "video", "canvas", "link", "meta", "base", "form", "input", "button"]);
const ANIMATION_NAMES = new Set(["set", "animate", "animatemotion", "animatetransform", "animatecolor", "discard"]);

const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
const ATTRIBUTE = /\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

const PREDEFINED: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Decodes the five predefined entities and numeric references. Any other `&` is an entity, and is refused. */
function decode(text: string): string {
  if (!text.includes("&")) return text;
  const bare = text.replace(/&(?:#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, "");
  if (bare.includes("&")) return refuse(REFUSALS.entities);
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!(code >= 32 || code === 9 || code === 10 || code === 13) || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return refuse(REFUSALS.notXml);
      return String.fromCodePoint(code);
    }
    return PREDEFINED[body];
  });
}

const urlTargets = /url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;

/** A value that reaches outside the file, runs code, or imports something is refused. */
export function checkValue(value: string): void {
  if (/javascript:|vbscript:|expression\s*\(|@import|-moz-binding|behavior\s*:/i.test(value)) refuse(REFUSALS.external);
  for (const match of value.matchAll(urlTargets)) if (!match[2].trim().startsWith("#")) refuse(REFUSALS.external);
}

const DATA_IMAGE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=\s]+$/i;

function checkAttribute(element: string, full: string, value: string): void {
  const local = full.includes(":") ? full.slice(full.indexOf(":") + 1) : full;
  if (/^on/i.test(local)) refuse(REFUSALS.eventHandler(full));
  if (local === "href" || local === "src") {
    const target = value.trim();
    const insideFile = target.startsWith("#");
    const picture = element === "image" && DATA_IMAGE.test(target);
    if (!insideFile && !picture) refuse(REFUSALS.external);
    return;
  }
  checkValue(value);
}

function checkName(name: string): void {
  const lower = name.toLowerCase();
  if (SCRIPT_NAMES.has(lower)) refuse(REFUSALS.script);
  if (lower === "foreignobject") refuse(REFUSALS.foreignObject);
  if (EMBED_NAMES.has(lower)) refuse(REFUSALS.embeddedContent);
  if (ANIMATION_NAMES.has(lower)) refuse(REFUSALS.animation);
}

/** Looks only for the markers of entity definitions; the reader itself never expands one. */
const ENTITY_MARKER = /<!\s*(?:DOCTYPE|ENTITY|ELEMENT|ATTLIST|NOTATION)/i;

export function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.byteLength > LIMITS.maxFileBytes) refuse(REFUSALS.tooBig(LIMITS.maxFileBytes / 1024));
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start));
  } catch {
    return refuse(REFUSALS.notUtf8);
  }
  return text.includes("\u0000") ? refuse(REFUSALS.notXml) : text;
}

type Cursor = { i: number };

function readStartTag(text: string, cursor: Cursor): { element: XmlElement; selfClosing: boolean } {
  NAME.lastIndex = cursor.i + 1;
  const found = NAME.exec(text);
  if (!found) return refuse(REFUSALS.notXml);
  const full = found[0];
  const colon = full.indexOf(":");
  checkName(colon >= 0 ? full.slice(colon + 1) : full);
  const element: XmlElement = {
    name: colon >= 0 ? full.slice(colon + 1) : full,
    prefix: colon >= 0 ? full.slice(0, colon) : null,
    attrs: {},
    children: [],
    text: "",
  };
  let at = NAME.lastIndex;
  let count = 0;
  for (;;) {
    ATTRIBUTE.lastIndex = at;
    const attribute = ATTRIBUTE.exec(text);
    if (!attribute) break;
    count += 1;
    if (count > MAX_ATTRIBUTES) return refuse(REFUSALS.tooComplex);
    const value = decode(attribute[2] ?? attribute[3] ?? "");
    if (value.length > LIMITS.maxFileBytes) return refuse(REFUSALS.tooBig(LIMITS.maxFileBytes / 1024));
    checkAttribute(element.name, attribute[1], value);
    const aColon = attribute[1].indexOf(":");
    const prefix = aColon >= 0 ? attribute[1].slice(0, aColon) : null;
    const local = aColon >= 0 ? attribute[1].slice(aColon + 1) : attribute[1];
    if (prefix === null || (prefix === "xlink" && local === "href") || (prefix === "xml" && local === "space")) {
      if (!(local in element.attrs)) element.attrs[local] = value;
    }
    at = ATTRIBUTE.lastIndex;
  }
  const rest = /\s*(\/?)>/y;
  rest.lastIndex = at;
  const end = rest.exec(text);
  if (!end) return refuse(REFUSALS.notXml);
  cursor.i = rest.lastIndex;
  return { element, selfClosing: end[1] === "/" };
}

/** Reads the document into a tree. The root is the first element; anything after it is ignored. */
export function parseXml(text: string, budget: Budget): XmlElement {
  if (ENTITY_MARKER.test(text)) refuse(REFUSALS.entities);
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  const cursor: Cursor = { i: 0 };
  const n = text.length;
  while (cursor.i < n && !(root && stack.length === 0)) {
    budget.tick();
    const lt = text.indexOf("<", cursor.i);
    const chunk = text.slice(cursor.i, lt < 0 ? n : lt);
    const top = stack.at(-1);
    if (top && top.text.length < MAX_TEXT) top.text += decode(chunk);
    else if (!top && chunk.trim() !== "") refuse(REFUSALS.notXml);
    if (lt < 0) break;
    cursor.i = lt;
    if (text.startsWith("<!--", lt)) {
      const end = text.indexOf("-->", lt + 4);
      if (end < 0) refuse(REFUSALS.notXml);
      cursor.i = end + 3;
    } else if (text.startsWith("<![CDATA[", lt)) {
      const end = text.indexOf("]]>", lt);
      if (end < 0 || !top) refuse(REFUSALS.notXml);
      if (top && top.text.length < MAX_TEXT) top.text += text.slice(lt + 9, end);
      cursor.i = end + 3;
    } else if (text.startsWith("<?", lt)) {
      const end = text.indexOf("?>", lt);
      if (end < 0) refuse(REFUSALS.notXml);
      if (/^<\?xml-stylesheet/i.test(text.slice(lt, lt + 20))) refuse(REFUSALS.external);
      cursor.i = end + 2;
    } else if (text.startsWith("<!", lt)) {
      refuse(REFUSALS.entities);
    } else if (text.startsWith("</", lt)) {
      const end = text.indexOf(">", lt);
      const closing = end < 0 ? "" : text.slice(lt + 2, end).trim();
      const open = stack.pop();
      const openName = open ? (open.prefix ? `${open.prefix}:${open.name}` : open.name) : null;
      if (end < 0 || !open || closing !== openName) refuse(REFUSALS.notXml);
      cursor.i = end + 1;
    } else {
      const { element, selfClosing } = readStartTag(text, cursor);
      budget.element(stack.length + 1);
      if (stack.length > 0) stack[stack.length - 1].children.push(element);
      else if (!root) root = element;
      if (!selfClosing) stack.push(element);
    }
  }
  if (!root || stack.length > 0) return refuse(REFUSALS.notXml);
  return root;
}
