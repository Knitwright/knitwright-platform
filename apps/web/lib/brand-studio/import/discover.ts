/**
 * What one page points at, read out of its markup and handed on **without** it.
 *
 * This is the only file in the feature that ever sees third-party markup, and it is a pure
 * function: markup in, addresses and colours out. Nothing it returns can hold a tag, because
 * everything it returns is a URL, a `#rrggbb` or a font family name, each checked before it leaves.
 * `lib/brand-studio/import/fetch.ts` calls it and then drops the markup on the same line.
 *
 * The regular expressions are deliberately plain. A parser would read more of a page, but it would
 * also hold the whole tree in memory and tempt somebody to keep it; this reads the handful of tags
 * F-S9 names (the favicon, the logo, the product photos, the page's own colours and fonts) and
 * nothing else.
 */

import type { Candidate, PageLinks, Why } from "./types";

/** As many of each kind as are read at all, before the caller trims to its own allowance. */
const MOST = 200;

/** A mark, by what the page calls it. Knitwright's own list of words, not anybody's standard. */
const LOGO_WORDS = /logo|brand|wordmark|crest|badge|emblem|monogram/i;

/** Addresses that are never a brand's own picture, whatever a page says. */
const NOT_A_PICTURE = /\.(svgz?|gif)$|^data:|spacer|pixel|tracking|1x1|placeholder|sprite/i;

/**
 * Hosts that serve a brand's **own** pictures for it. Instagram is in F-S9 by name, and its
 * pictures come from its own content network rather than from instagram.com, so a brand that pastes
 * its Instagram page would otherwise get no pictures at all. This list is a Knitwright draft and an
 * owner question; it is deliberately short, and every other host is a different site.
 */
const SERVES_FOR: Readonly<Record<string, readonly string[]>> = {
  "instagram.com": ["cdninstagram.com", "fbcdn.net"],
};

/** The registrable-looking tail of a host: the last two labels, lower case. */
export const siteOf = (host: string): string => host.toLowerCase().split(".").slice(-2).join(".");

/** True when a candidate's host is the page's own site, a subdomain of it, or its picture network. */
export function sameSite(pageHost: string, candidateHost: string): boolean {
  const page = siteOf(pageHost);
  const candidate = siteOf(candidateHost);
  if (page === candidate) return true;
  return (SERVES_FOR[page] ?? []).includes(candidate);
}

/** One absolute https address on the page's own site, or null. Anything else is somebody else's. */
export function ownAddress(raw: string, page: URL): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.startsWith("data:")) return null;
  let url: URL;
  try {
    url = new URL(trimmed, page);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!sameSite(page.host, url.host)) return null;
  url.hash = "";
  return url;
}

/** The value of one attribute of a tag, as words. Entities are left alone: a URL has none we need. */
const attribute = (tag: string, name: string): string | null => {
  const found = new RegExp(`\\s${name}\\s*=\\s*("([^"]{0,2000})"|'([^']{0,2000})'|([^\\s">]{1,2000}))`, "i").exec(tag);
  return found === null ? null : (found[2] ?? found[3] ?? found[4]!).trim() || null;
};

/** The first address of a `srcset`, which is the one the page offers smallest-first. */
const firstOfSrcset = (value: string | null): string | null => {
  const first = value === null ? "" : value.split(",")[0]!.trim().split(/\s+/)[0]!;
  return first === "" ? null : first;
};

const tagsOf = (html: string, name: string): string[] => [...html.matchAll(new RegExp(`<${name}\\b[^>]{0,3000}>`, "gi"))].map((m) => m[0]).slice(0, MOST);

const candidate = (url: URL, why: Why, alt: string | null): Candidate => ({ url: url.toString(), why, alt: alt?.slice(0, 120) ?? null });

const unique = (found: readonly Candidate[]): readonly Candidate[] => {
  const seen = new Set<string>();
  return found.filter((one) => (seen.has(one.url) ? false : (seen.add(one.url), true)));
};

/** The favicon, the touch icon and the manifest's icon: the marks a site states about itself. */
function iconsOf(html: string, page: URL): readonly Candidate[] {
  const whyOf = (rel: string): Why | null => {
    if (/apple-touch-icon/i.test(rel)) return "apple-touch-icon";
    if (/\bicon\b|shortcut/i.test(rel)) return "favicon";
    if (/manifest/i.test(rel)) return "manifest-icon";
    return null;
  };
  const found = tagsOf(html, "link").flatMap((tag) => {
    const why = whyOf(attribute(tag, "rel") ?? "");
    const href = attribute(tag, "href");
    if (why === null || href === null) return [];
    const url = ownAddress(href, page);
    return url === null ? [] : [candidate(url, why, attribute(tag, "title"))];
  });
  const fallback = ownAddress("/favicon.ico", page);
  return unique(found.length > 0 || fallback === null ? found : [candidate(fallback, "favicon", null)]);
}

/** The picture a page offers social networks. A brand's own, and usually its best. */
const ogImagesOf = (html: string, page: URL): readonly Candidate[] =>
  unique(
    tagsOf(html, "meta").flatMap((tag) => {
      if (!/property\s*=\s*["']?og:image/i.test(tag)) return [];
      const url = ownAddress(attribute(tag, "content") ?? "", page);
      return url === null ? [] : [candidate(url, "og-image", null)];
    }),
  );

type Pictures = Readonly<{ logos: readonly Candidate[]; pictures: readonly Candidate[] }>;

/** Every `<img>` the page holds, split into marks and product photos by what the page calls them. */
function imagesOf(html: string, page: URL): Pictures {
  const all = tagsOf(html, "img").flatMap((tag) => {
    const raw = attribute(tag, "src") ?? attribute(tag, "data-src") ?? firstOfSrcset(attribute(tag, "srcset"));
    if (raw === null || NOT_A_PICTURE.test(raw)) return [];
    const url = ownAddress(raw, page);
    if (url === null) return [];
    const alt = attribute(tag, "alt");
    const said = `${raw} ${alt ?? ""} ${attribute(tag, "class") ?? ""} ${attribute(tag, "id") ?? ""}`;
    return [{ mark: LOGO_WORDS.test(said), one: candidate(url, LOGO_WORDS.test(said) ? "img-logo" : "img-product", alt) }];
  });
  return { logos: unique(all.filter((row) => row.mark).map((row) => row.one)), pictures: unique(all.filter((row) => !row.mark).map((row) => row.one)) };
}

/** Everything between `<style>` tags, plus every `style=` attribute: the page's own look. */
export function stylesOf(html: string): string {
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]{0,200000}?)<\/style>/gi)].map((m) => m[1]!);
  const inline = [...html.matchAll(/\sstyle\s*=\s*"([^"]{0,2000})"/gi)].map((m) => m[1]!);
  const themes = tagsOf(html, "meta")
    .filter((tag) => /name\s*=\s*["']?theme-color/i.test(tag))
    .map((tag) => attribute(tag, "content") ?? "");
  return [...blocks, ...inline, ...themes].join("\n").slice(0, 400_000);
}

const SHORT_HEX = /#([0-9a-f])([0-9a-f])([0-9a-f])\b/gi;
const LONG_HEX = /#([0-9a-f]{6})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/gi;

const byteHex = (value: string): string => Math.min(255, Number(value)).toString(16).padStart(2, "0");

/** Every `#rrggbb` the styles name, in the order first met. `#abc`, `#aabbcc` and `rgb()` all count. */
export function coloursOfStyles(styles: string): readonly string[] {
  const short = [...styles.matchAll(SHORT_HEX)].map((m) => `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase());
  const long = [...styles.matchAll(LONG_HEX)].map((m) => `#${m[1]}`.toLowerCase());
  const rgb = [...styles.matchAll(RGB)].map((m) => `#${byteHex(m[1]!)}${byteHex(m[2]!)}${byteHex(m[3]!)}`);
  return [...new Set([...long, ...short, ...rgb])].slice(0, MOST);
}

const QUOTED = /^['"]|['"]$/g;
/**
 * The families nobody chose as a brand font: the CSS generics, the system stack every reset names,
 * and the faces a browser already has. A page that falls back to Georgia has not told us its font.
 */
const GENERIC =
  /^(inherit|initial|unset|revert|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|helvetica neue|arial|sans|emoji|math|fangsong|georgia|times|times new roman|courier|courier new|verdana|tahoma|trebuchet ms|palatino|palatino linotype|lucida grande|noto sans|apple color emoji|segoe ui emoji|noto color emoji)$/i;

/** One family name as written, trimmed of quotes. Null when it is a generic the page did not choose. */
const familyName = (raw: string): string | null => {
  const name = raw.trim().replace(QUOTED, "").trim();
  if (name === "" || name.length > 60 || GENERIC.test(name)) return null;
  return name;
};

/** The families the page asked for: its own `font-family` rules and any web-font link it loaded. */
export function fontsOfPage(html: string, styles: string): readonly string[] {
  const declared = [...styles.matchAll(/font-family\s*:\s*([^;}"]{1,300})/gi)].flatMap((m) => m[1]!.split(",").map(familyName));
  const linked = tagsOf(html, "link").flatMap((tag) => {
    const href = attribute(tag, "href") ?? "";
    if (!/fonts\.(googleapis|bunny|gstatic)\.|typekit|fontshare|fonts\.net/i.test(href)) return [];
    return [...href.matchAll(/family=([^&:]{1,60})/gi)].map((m) => familyName(decodeURIComponent(m[1]!).replaceAll("+", " ")));
  });
  return [...new Set([...linked, ...declared].filter((name): name is string => name !== null))].slice(0, MOST);
}

/**
 * What one page points at. The markup goes in; addresses, colours and family names come out, and
 * the caller drops the markup. Nothing returned here can hold a tag.
 */
export function linksOfPage(html: string, pageUrl: string): PageLinks {
  const page = new URL(pageUrl);
  const styles = stylesOf(html);
  const images = imagesOf(html, page);
  return {
    icons: iconsOf(html, page),
    logos: images.logos,
    pictures: unique([...ogImagesOf(html, page), ...images.pictures]),
    cssColours: coloursOfStyles(styles),
    fontFamilies: fontsOfPage(html, styles),
  };
}
