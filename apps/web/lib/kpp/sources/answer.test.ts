import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { exportPackage } from "../export";
import { fixtureSources } from "../fixtures/jsy-ss-01";
import { fixtureRows } from "../fixtures/rows";
import { buildKppInput } from "../input";
import type { KppRows } from "../input";
import { CANNOT_BUILD, creditHeaders, gapLines, packageRefusal, packageResponse } from "./answer";
import { draftedPattern } from "./pattern";

/**
 * What the export route answers: the gate's refusal in the gate's own words, or the ZIP sent once. The results
 * come from the real `exportPackage` over the real catalogue rows, so what is asserted here is the answer a
 * member would actually get.
 */

const sources = () => {
  const outcome = draftedPattern("JSY-SS-01");
  if (!outcome.ok) throw new Error(outcome.reason);
  return fixtureSources({ pattern: outcome.source });
};

const built = (rows: KppRows = fixtureRows()) => exportPackage(buildKppInput(rows), sources());

/** The same rows with the first point of measure's tolerance taken away, which owner decision 18 refuses. */
const noTolerance = (): KppRows => {
  const rows = fixtureRows();
  const poms = rows.article.poms.map((pom, index) => (index === 0 ? ({ ...pom, tolMinusMm: null, tolPlusMm: null } as typeof pom) : pom));
  return { ...rows, article: { ...rows.article, poms } };
};

describe("a package the gate refuses", () => {
  it("is a 409 that names every gap, because nothing about the request is wrong", async () => {
    const result = await built(noTolerance());
    if (result.ok) throw new Error("The gate should have refused this package.");

    const error = packageRefusal(result);

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("conflict");
    expect(error.message).toContain(CANNOT_BUILD);
    expect(error.message).toContain("no tolerance");
  });

  it("gives the member one line per gap, each with the field it is about and its rule", async () => {
    const result = await built(noTolerance());
    if (result.ok) throw new Error("The gate should have refused this package.");

    const lines = gapLines(result.issues);

    expect(lines).toHaveLength(result.issues.length);
    expect(lines.join("\n")).toMatch(/^poms\[0]\.tolerance: .*no tolerance\. \(R-[A-Z]+-\d{3}\)$/m);
    expect(packageRefusal(result).fields?.package).toEqual(lines);
  });

  it("passes the credits gate's own sentence on when the charge was refused", () => {
    const error = packageRefusal({ ok: false, reason: "refused", message: "Production package costs 1 credit. Your balance is 0." });

    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Production package costs 1 credit. Your balance is 0.");
    expect(error.message).not.toContain(CANNOT_BUILD);
  });
});

describe("the package itself", () => {
  it("is sent once as a ZIP that is never stored, under the name the package root gives", async () => {
    const result = await built();
    if (!result.ok) throw new Error(result.reason === "blocked" ? gapLines(result.issues).join("\n") : result.message);

    const response = packageResponse(result.zip, result.record.fileName, null);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${result.record.fileName}"`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-length")).toBe(String(result.zip.byteLength));
    expect((await response.arrayBuffer()).byteLength).toBe(result.zip.byteLength);
  }, 120_000);

  it("carries the credit headers when something was charged, and none when nothing was", () => {
    expect(creditHeaders(null)).toEqual({});
    const charged = packageResponse(new Uint8Array([1, 2, 3]), "x.zip", { price: 1, charged: true, balance: 4 });
    expect(charged.headers.get("x-credits-price")).toBe("1");
    expect(charged.headers.get("x-credits-charged")).toBe("true");
    expect(charged.headers.get("x-credits-balance")).toBe("4");
  });
});
