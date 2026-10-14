/** Small PDF files made on the spot, for tests. Page size is 200 x 100 points. */
export function buildPdf(content: string, options: Readonly<{ catalog?: string; resources?: string; extraObjects?: readonly string[]; pages?: number }> = {}): Uint8Array {
  const pages = options.pages ?? 1;
  const kids = Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(" ");
  const first = 3 + pages;
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${options.catalog ?? ""} >>`,
    `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, () => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents ${first} 0 R /Resources << ${options.resources ?? ""} >> >>`),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    ...(options.extraObjects ?? []),
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

/** A red rectangle, a blue stroked polyline, a green square under a scale, and a black curve filled. */
export const SIMPLE_CONTENT = "1 0 0 rg 10 10 50 30 re f 0 0 1 RG 3 w 70 10 m 120 60 l 150 10 l S q 0.5 0 0 0.5 100 50 cm 0 1 0 rg 0 0 40 40 re f Q 0 0 0 1 k 5 80 m 5 95 40 95 40 80 c h f";

export const WITH_JAVASCRIPT = buildPdf(SIMPLE_CONTENT, { catalog: "/OpenAction << /S /JavaScript /JS (app.alert\\(1\\)) >>" });

export const WITH_TEXT = buildPdf(`${SIMPLE_CONTENT} BT /F1 12 Tf 10 50 Td (Hello) Tj ET`, {
  resources: "/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >>",
});

export const WITH_CLIP = buildPdf("q 10 10 40 40 re W n 1 0 0 rg 0 0 100 100 re f Q 0 0 1 rg 100 10 20 20 re f");

export const WITH_SHADING = buildPdf("/Sh0 sh", {
  resources: "/Shading << /Sh0 << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0 200 0] /Function << /FunctionType 2 /Domain [0 1] /C0 [1 0 0] /C1 [0 0 1] /N 1 >> >> >>",
});

export const WITH_IMAGE = buildPdf("q 100 0 0 50 10 10 cm /Im0 Do Q", {
  resources: "/XObject << /Im0 5 0 R >>",
  extraObjects: ["<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\n\u0080\nendstream"],
});
