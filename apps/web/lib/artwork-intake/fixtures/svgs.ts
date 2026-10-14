/** Small SVG files made on the spot, for tests. */
const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

export const svgOf = (inner: string, attrs = 'width="100" height="50" viewBox="0 0 100 50"'): string => `<svg ${NS} ${attrs}>${inner}</svg>`;

export const CLEAN_LOGO = svgOf(`
  <style>.red{fill:#cc0000}.line{fill:none;stroke:#003366;stroke-width:2}</style>
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#0044cc" stop-opacity=".5"/></linearGradient>
    <clipPath id="box"><rect x="0" y="0" width="60" height="50"/></clipPath>
    <g id="dot"><circle cx="5" cy="5" r="4"/></g>
  </defs>
  <title>Club crest</title>
  <rect class="red" x="5" y="5" width="30" height="20" rx="3"/>
  <path class="line" d="M10 40 C 20 30, 30 50, 40 40"/>
  <ellipse cx="70" cy="25" rx="20" ry="10" fill="url(#fade)" clip-path="url(#box)"/>
  <use href="#dot" x="80" y="30" fill="orange" transform="scale(1.5)"/>
  <polygon points="90,5 95,15 85,15" fill="rgb(0,128,0)" fill-opacity="0.5" opacity="0.8"/>
  <text x="5" y="48">Hello</text>
`);

export const WITH_SCRIPT = svgOf('<script>alert(document.cookie)</script><rect width="10" height="10"/>');
export const WITH_ONLOAD = svgOf('<rect width="10" height="10"/>', 'width="100" height="50" onload="alert(1)"');
export const WITH_EXTERNAL_HREF = svgOf('<image href="https://evil.example/track.png" width="10" height="10"/>');
export const WITH_USE_EXTERNAL = svgOf('<use xlink:href="https://evil.example/x.svg#a"/>');
export const WITH_FOREIGN_OBJECT = svgOf('<foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml"/></foreignObject>');
export const WITH_CSS_IMPORT = svgOf('<style>@import url("https://evil.example/a.css");</style><rect width="10" height="10"/>');

/** A billion-laughs file: a few lines that would expand to gigabytes if entities were expanded. */
export const ENTITY_BOMB = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY a "aaaaaaaaaa">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
  <!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">
]>
<svg ${NS} width="10" height="10"><text>&d;</text></svg>`;

/** Many nested uses: each level has ten of the one below, so it would draw a hundred million shapes. */
export const USE_BOMB = svgOf(
  `<defs><rect id="l0" width="1" height="1"/>${Array.from({ length: 7 }, (_, i) => `<g id="l${i + 1}">${`<use href="#l${i}"/>`.repeat(10)}</g>`).join("")}</defs><use href="#l7"/>`,
);

export const TINY_PNG_DATA =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
export const WITH_EMBEDDED_PNG = svgOf(`<image x="10" y="10" width="40" height="20" href="data:image/png;base64,${TINY_PNG_DATA}"/><rect width="5" height="5" fill="red"/>`);
