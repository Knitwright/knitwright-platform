import type { SvgRefusal } from "../messages";
import { refuse } from "./refusal";
import type { XmlElement } from "./xml";

/**
 * The allow-list gate. It reads every element and attribute of the file, including those the converter
 * will later skip, and refuses the file for anything that could run, load or reach outside it. This runs
 * before any conversion, so a refused file leaves nothing behind.
 */

const REFUSED_ELEMENTS: Readonly<Record<string, SvgRefusal>> = {
  script: "script",
  foreignobject: "foreignObject",
  handler: "script",
  listener: "script",
  iframe: "foreignObject",
  object: "foreignObject",
  embed: "foreignObject",
  audio: "foreignObject",
  video: "foreignObject",
  canvas: "foreignObject",
  link: "externalReference",
  animate: "animation",
  animatemotion: "animation",
  animatetransform: "animation",
  animatecolor: "animation",
  set: "animation",
  discard: "animation",
};

const HREF_NAMES = new Set(["href", "xlink:href", "src", "action", "formaction"]);
const DATA_IMAGE = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=\s]*$/i;

/** Text with the spaces and control characters people hide a keyword behind removed. */
const squashed = (value: string): string => value.replace(/[\s\u0000-\u001f]+/g, "").toLowerCase();

/** Refuses script, import and outside references in a piece of text: an attribute, a style rule or a style sheet. */
export const scanText = (value: string): void => {
  const flat = squashed(value);
  if (flat.includes("javascript:") || flat.includes("vbscript:") || flat.includes("expression(") || flat.includes("-moz-binding") || flat.includes("behavior:")) {
    refuse("script");
  }
  if (flat.includes("@import")) refuse("stylesheetImport");
  if (/data:text\/html|data:image\/svg|data:application/.test(flat)) refuse("externalReference");
  for (const match of flat.matchAll(/url\(['"]?([^)]*)/g)) {
    if (!match[1].startsWith("#")) refuse("externalReference");
  }
};

const checkHref = (element: XmlElement, value: string): void => {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return;
  // A picture may be inside the file as a PNG or JPEG. It is read again as pixels, never kept as it came.
  if (element.name === "image" && DATA_IMAGE.test(trimmed)) return;
  refuse("externalReference");
};

const checkAttributes = (element: XmlElement): void => {
  for (const [name, value] of element.attrs) {
    const local = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    if (/^on/i.test(local)) refuse("eventHandler");
    if (HREF_NAMES.has(name.toLowerCase())) checkHref(element, value);
    else scanText(value);
  }
};

/** Walks the whole tree. Throws the refusal for the first thing found. */
export const scanTree = (root: XmlElement): void => {
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const element = stack.pop() as XmlElement;
    const reason = REFUSED_ELEMENTS[element.name];
    if (reason) refuse(reason);
    checkAttributes(element);
    if (element.name === "style") scanText(element.text);
    stack.push(...[...element.children].reverse());
  }
};

/** Every id in the tree, so `use` and gradient references can be checked to point inside the file. */
export const collectIds = (root: XmlElement): ReadonlyMap<string, XmlElement> => {
  const ids = new Map<string, XmlElement>();
  const stack: XmlElement[] = [root];
  while (stack.length > 0) {
    const element = stack.pop() as XmlElement;
    const id = element.attrs.get("id");
    if (id !== undefined && !ids.has(id)) ids.set(id, element);
    stack.push(...[...element.children].reverse());
  }
  return ids;
};
