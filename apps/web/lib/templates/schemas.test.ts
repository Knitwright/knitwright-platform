import { describe, expect, it } from "vitest";
import { editorAddress, useTemplateSchema } from "./schemas";

describe("using a template", () => {
  it("takes a template id", () => {
    expect(useTemplateSchema.safeParse({ templateId: "22222222-2222-4222-8222-222222222222" }).success).toBe(true);
  });

  it("refuses anything else, and ignores a brand sent by the browser", () => {
    expect(useTemplateSchema.safeParse({ templateId: "nope" }).success).toBe(false);
    expect(useTemplateSchema.safeParse({}).success).toBe(false);
    const parsed = useTemplateSchema.parse({ templateId: "22222222-2222-4222-8222-222222222222", brandId: "x" });
    expect(parsed).toEqual({ templateId: "22222222-2222-4222-8222-222222222222" });
  });

  it("opens the editor on the new design", () => {
    expect(editorAddress("abc")).toBe("/studio/abc");
  });
});
