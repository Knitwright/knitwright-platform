import { describe, expect, it } from "vitest";
import { Budget } from "./budget";
import { REFUSALS } from "./refuse";
import { decodeUtf8, parseXml } from "./xml";

const read = (text: string) => parseXml(text, new Budget());
const svg = (inner: string, attrs = "") => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;

describe("parseXml", () => {
  it("builds a tree of elements with their attributes and text", () => {
    const root = read(`<?xml version="1.0"?><!-- c --><svg viewBox="0 0 10 10" xmlns:xlink="x"><g id='a'><path d="M0 0"/></g><style><![CDATA[.a{fill:red}]]></style></svg>`);
    expect(root.name).toBe("svg");
    expect(root.attrs.viewBox).toBe("0 0 10 10");
    expect(root.children.map((c) => c.name)).toEqual(["g", "style"]);
    expect(root.children[0].attrs.id).toBe("a");
    expect(root.children[0].children[0].attrs.d).toBe("M0 0");
    expect(root.children[1].text).toBe(".a{fill:red}");
  });

  it("decodes the predefined entities and character references in text and attributes", () => {
    const root = read(svg("<title>a &amp; b &#65;&#x42;</title>", 'data-x="&lt;&quot;"'));
    expect(root.children[0].text).toBe("a & b AB");
    expect(root.attrs["data-x"]).toBe('<"');
  });

  it("keeps xlink:href as href and drops editor attributes with other prefixes", () => {
    const root = read(svg('<use xlink:href="#a" inkscape:label="x" xml:space="preserve"/>'));
    expect(root.children[0].attrs).toEqual({ href: "#a", space: "preserve" });
  });

  it("refuses a script, however it is named or prefixed", () => {
    for (const text of [svg("<script>alert(1)</script>"), svg('<svg:script xmlns:svg="x"/>'), svg("<SCRIPT/>"), svg("<handler/>")]) {
      expect(() => read(text)).toThrow(REFUSALS.script);
    }
  });

  it("refuses an event handler on any element", () => {
    expect(() => read(svg("", 'onload="alert(1)"'))).toThrow(/event handler \(onload\)/);
    expect(() => read(svg('<rect onclick="x()"/>'))).toThrow(/event handler/);
    expect(() => read(svg('<rect xlink:onmouseover="x()"/>'))).toThrow(/event handler/);
  });

  it("refuses foreignObject, embedded content and animation", () => {
    expect(() => read(svg("<foreignObject><div/></foreignObject>"))).toThrow(REFUSALS.foreignObject);
    for (const name of ["iframe", "object", "embed", "video", "link", "meta"]) expect(() => read(svg(`<${name}/>`))).toThrow(REFUSALS.embeddedContent);
    for (const name of ["animate", "set", "animateTransform"]) expect(() => read(svg(`<${name}/>`))).toThrow(REFUSALS.animation);
  });

  it("refuses any reference to a place outside the file", () => {
    for (const href of ["http://evil.example/a.svg", "https://x/y.png", "file:///etc/passwd", "//host/x", "javascript:alert(1)", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,AAAA", "a.png"]) {
      expect(() => read(svg(`<image href="${href}"/>`))).toThrow(REFUSALS.external);
      expect(() => read(svg(`<use xlink:href="${href}"/>`))).toThrow(REFUSALS.external);
    }
    expect(() => read(svg('<rect fill="url(http://x/y#a)"/>'))).toThrow(REFUSALS.external);
    expect(() => read(svg('<rect style="fill:url(\'https://x\')"/>'))).toThrow(REFUSALS.external);
    expect(() => read(svg('<rect style="background:expression(alert(1))"/>'))).toThrow(REFUSALS.external);
    expect(() => read(svg('<image src="x.png"/>'))).toThrow(REFUSALS.external);
    expect(() => read('<?xml-stylesheet href="x.css"?><svg/>')).toThrow(REFUSALS.external);
  });

  it("allows references inside the file and a picture carried as data", () => {
    expect(() => read(svg('<use href="#a"/><rect fill="url(#g)"/><image href="data:image/png;base64,AAAA"/>'))).not.toThrow();
  });

  it("refuses entity definitions and undefined entities, including the billion laughs", () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">]><svg>&lol2;</svg>`;
    expect(() => read(bomb)).toThrow(REFUSALS.entities);
    expect(() => read(svg("<title>&undefined;</title>"))).toThrow(REFUSALS.entities);
    expect(() => read(svg("<!ELEMENT x>"))).toThrow(REFUSALS.entities);
    expect(() => read(`<!DOCTYPE svg SYSTEM "http://x/y.dtd"><svg/>`)).toThrow(REFUSALS.entities);
  });

  it("refuses bad character references and malformed documents", () => {
    expect(() => read(svg("<title>&#0;</title>"))).toThrow(REFUSALS.notXml);
    expect(() => read(svg("<title>&#xD800;</title>"))).toThrow(REFUSALS.notXml);
    for (const bad of ["", "text", "<svg>", "<svg></g>", "<svg", "<svg a=1/>", "<svg><!-- open</svg>", "<svg><![CDATA[x</svg>", "<?xml", "</svg>", "<1/>", "<svg></svg" ]) {
      expect(() => read(bad), bad).toThrow(REFUSALS.notXml);
    }
    expect(() => read("junk<svg/>")).toThrow(REFUSALS.notXml);
    expect(() => read("<![CDATA[x]]><svg/>")).toThrow(REFUSALS.notXml);
  });

  it("ignores anything after the root element", () => {
    expect(read("<svg/><svg/>").name).toBe("svg");
  });

  it("stops at the element, depth and attribute limits", () => {
    expect(() => read(svg("<g>".repeat(40) + "</g>".repeat(40)))).toThrow(REFUSALS.tooDeep);
    expect(() => read(svg("<g/>".repeat(21_000)))).toThrow(REFUSALS.tooComplex);
    const many = Array.from({ length: 90 }, (_, i) => `a${i}="1"`).join(" ");
    expect(() => read(svg(`<g ${many}/>`))).toThrow(REFUSALS.tooComplex);
  });
});

describe("decodeUtf8", () => {
  it("reads UTF-8 with or without a byte order mark", () => {
    expect(decodeUtf8(new TextEncoder().encode("é<svg/>"))).toBe("é<svg/>");
    expect(decodeUtf8(Uint8Array.from([0xef, 0xbb, 0xbf, 0x3c]))).toBe("<");
  });

  it("refuses other encodings, a null byte and a file over the limit", () => {
    expect(() => decodeUtf8(Uint8Array.from([0x3c, 0xff, 0xfe]))).toThrow(REFUSALS.notUtf8);
    expect(() => decodeUtf8(Uint8Array.from([0x3c, 0x00]))).toThrow(REFUSALS.notXml);
    expect(() => decodeUtf8(new Uint8Array(6 * 1024 * 1024))).toThrow(/too large/);
  });
});
