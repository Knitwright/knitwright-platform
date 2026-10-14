import { describe, expect, it } from "vitest";
import { SVG_REFUSALS, type SvgRefusal } from "../messages";
import { reencodeEmbedded } from "./embed";
import { parseSvg } from "./parse";

const text = (value: string) => new TextEncoder().encode(value);
const wrap = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" ${attrs}>${inner}</svg>`;
const parse = (source: string) => parseSvg(text(source), reencodeEmbedded);

const refused = async (source: string, reason: SvgRefusal) => {
  await expect(parse(source)).rejects.toMatchObject({ message: SVG_REFUSALS[reason], code: "invalid_input" });
};

const SQUARE = '<rect width="10" height="10"/>';

describe("an SVG that could run or load something is refused", () => {
  it("refuses a script element, in any case or with a prefix", async () => {
    await refused(wrap(`<script>alert(1)</script>${SQUARE}`), "script");
    await refused(wrap(`<SCRIPT>alert(1)</SCRIPT>${SQUARE}`), "script");
    await refused(wrap(`<svg:script>alert(1)</svg:script>${SQUARE}`), "script");
  });

  it("refuses event attributes, on any element", async () => {
    await refused(wrap(SQUARE, 'onload="alert(1)"'), "eventHandler");
    await refused(wrap('<rect width="1" height="1" onclick="x()"/>'), "eventHandler");
    await refused(wrap('<g><rect width="1" height="1" OnMouseOver="x()"/></g>'), "eventHandler");
  });

  it("refuses foreignObject and other embedded content", async () => {
    await refused(wrap(`<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"/></foreignObject>${SQUARE}`), "foreignObject");
    await refused(wrap(`<iframe src="#x"/>${SQUARE}`), "foreignObject");
  });

  it("refuses an external reference of any kind", async () => {
    await refused(wrap('<image href="https://example.com/a.png" width="5" height="5"/>'), "externalReference");
    await refused(wrap('<image xlink:href="file:///etc/passwd" width="5" height="5"/>'), "externalReference");
    await refused(wrap('<image href="logo.png" width="5" height="5"/>'), "externalReference");
    await refused(wrap('<a href="https://example.com"><rect width="1" height="1"/></a>'), "externalReference");
    await refused(wrap('<rect width="5" height="5" fill="url(https://example.com/x.svg#a)"/>'), "externalReference");
    await refused(wrap('<rect width="5" height="5" style="fill:url(//example.com/x)"/>'), "externalReference");
    await refused(wrap('<use href="other.svg#a"/>'), "externalReference");
    await refused(wrap('<image href="data:image/svg+xml;base64,PHN2Zy8+" width="5" height="5"/>'), "externalReference");
    await refused(wrap('<image href="data:text/html;base64,PGI+" width="5" height="5"/>'), "externalReference");
    await refused(`<?xml-stylesheet href="https://example.com/x.css"?>${wrap(SQUARE)}`, "externalReference");
  });

  it("refuses javascript addresses even when hidden behind spaces or entities", async () => {
    await refused(wrap('<a href="java&#x09;script:alert(1)"><rect width="1" height="1"/></a>'), "externalReference");
    await refused(wrap('<rect width="5" height="5" style="background:url(javascript:alert(1))"/>'), "script");
    await refused(wrap('<rect width="5" height="5" style="width:expression(alert(1))"/>'), "script");
  });

  it("refuses @import in a style element or a style attribute", async () => {
    await refused(wrap(`<style>@import url(https://example.com/a.css); .a{fill:red}</style>${SQUARE}`), "stylesheetImport");
    await refused(wrap(`<style>@import "a.css";</style>${SQUARE}`), "stylesheetImport");
  });

  it("refuses entity and document type declarations, including an entity bomb", async () => {
    const bomb =
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]>' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&c;</text></svg>';
    await refused(bomb, "entities");
    await refused('<!DOCTYPE svg SYSTEM "http://example.com/x.dtd">' + wrap(SQUARE), "entities");
    await refused(wrap('<rect width="1" height="1" id="&xxe;"/>'), "entities");
  });

  it("refuses use pointing outside the file, to nothing, or to itself", async () => {
    await refused(wrap('<use href="#missing"/>'), "badUse");
    await refused(wrap('<g id="a"><use href="#a"/></g>'), "badUse");
    await refused(wrap('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g><use href="#a"/>'), "badUse");
  });

  it("refuses animation", async () => {
    await refused(wrap('<rect width="1" height="1"><animate attributeName="x" to="5"/></rect>'), "animation");
    await refused(wrap('<rect width="1" height="1"><set attributeName="href" to="javascript:x()"/></rect>'), "animation");
  });

  it("refuses text that is not an SVG, or not well formed", async () => {
    await refused("<svg><g></svg>", "malformed");
    await refused(wrap('<rect width="1" height="1" width="2"/>'), "malformed");
    await refused(wrap("<rect width=1/>"), "malformed");
    await refused(wrap("<rect/><!-- never closed"), "malformed");
    await refused(wrap("a & b"), "malformed");
    await refused(wrap("&#0;"), "malformed");
    await refused("<svg/><svg/>", "malformed");
    await refused("text before<svg/>", "malformed");
    await refused('<?xml version="1.0"?>   <?php echo 1 ?><svg/>', "externalReference");
    await expect(parse("<html/>")).rejects.toMatchObject({ code: "invalid_input" });
    await expect(parseSvg(Uint8Array.from([0x3c, 0x73, 0xff, 0xfe]), reencodeEmbedded)).rejects.toMatchObject({ message: SVG_REFUSALS.malformed });
  });
});

describe("an SVG over the limits is refused", () => {
  it("refuses too many nodes and too deep nesting", async () => {
    await refused(wrap(`<g>${'<rect width="1" height="1"/>'.repeat(20_001)}</g>`), "tooComplex");
    await refused(wrap(`${"<g>".repeat(40)}${SQUARE}${"</g>".repeat(40)}`), "tooComplex");
  });

  it("refuses a use that expands past the limit", async () => {
    const uses = '<use href="#r"/>'.repeat(2_001);
    await refused(wrap(`<defs><rect id="r" width="1" height="1"/></defs>${uses}`), "tooComplex");
  });

  it("refuses too many path commands, and a file that is too big", async () => {
    await refused(wrap(`<path d="${"M0 0L1 1".repeat(110_000)}"/>`), "tooComplex");
    await expect(parseSvg(new Uint8Array(6 * 1024 * 1024).fill(32), reencodeEmbedded)).rejects.toMatchObject({ message: SVG_REFUSALS.tooComplex });
  });

  it("refuses more embedded pictures than allowed", async () => {
    const image = '<image width="1" height="1" href="data:image/png;base64,iVBORw0KGgo="/>';
    await refused(wrap(image.repeat(9)), "tooComplex");
  });

  it("refuses a very long attribute", async () => {
    await refused(wrap(`<rect width="1" height="1" data-x="${"a".repeat(400_001)}"/>`), "tooComplex");
  });
});
