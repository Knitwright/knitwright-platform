import { describe, expect, it } from "vitest";
import {
  DOWNLOAD_CONTROLS,
  busyAnnouncement,
  downloadAddress,
  downloadFile,
  failureSentence,
  fileNameFromDisposition,
  finishDownload,
  isBusyWith,
  startDownload,
} from "./download-controls";

const PROJECT = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const [PDF, EXCEL, FRONT, BACK] = DOWNLOAD_CONTROLS;

const answerWith = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

describe("the four downloads", () => {
  it("are the PDF, Excel, the front drawing and the back drawing, in that order", () => {
    expect(DOWNLOAD_CONTROLS.map((control) => control.label)).toEqual(["PDF", "Excel", "SVG front", "SVG back"]);
    expect(DOWNLOAD_CONTROLS.map((control) => control.format)).toEqual(["pdf", "xlsx", "svg", "svg"]);
    expect(new Set(DOWNLOAD_CONTROLS.map((control) => control.id)).size).toBe(4);
  });

  it("are named so that the visible label is inside the name a screen reader says", () => {
    for (const control of DOWNLOAD_CONTROLS) expect(control.accessibleName).toContain(control.label);
    expect(DOWNLOAD_CONTROLS.map((control) => control.accessibleName)).toEqual([
      "Download PDF",
      "Download Excel",
      "Download SVG front",
      "Download SVG back",
    ]);
  });
});

describe("the address to call", () => {
  it("names the design, the format and the version shown", () => {
    expect(downloadAddress(PROJECT, PDF, { version: 3 })).toBe(`/api/projects/${PROJECT}/exports/pdf?version=3`);
    expect(downloadAddress(PROJECT, EXCEL, { version: 3 })).toBe(`/api/projects/${PROJECT}/exports/xlsx?version=3`);
  });

  it("adds the view for a drawing", () => {
    expect(downloadAddress(PROJECT, FRONT, { version: 3 })).toBe(`/api/projects/${PROJECT}/exports/svg?view=front&version=3`);
    expect(downloadAddress(PROJECT, BACK, { version: 12 })).toBe(`/api/projects/${PROJECT}/exports/svg?view=back&version=12`);
  });

  it("carries the colourway of the page, encoded, and leaves it out when there is none", () => {
    expect(downloadAddress(PROJECT, PDF, { version: 1, colourwayId: "away kit&x" })).toBe(
      `/api/projects/${PROJECT}/exports/pdf?version=1&colourway=away%20kit%26x`,
    );
    expect(downloadAddress(PROJECT, PDF, { version: 1, colourwayId: undefined })).not.toContain("colourway");
  });

  it("encodes a design id that is not a plain id, so it cannot change the path", () => {
    expect(downloadAddress("../x?y", PDF, { version: 1 })).toBe("/api/projects/..%2Fx%3Fy/exports/pdf?version=1");
  });
});

describe("the name a file is saved under", () => {
  it("is read from the plain name in the header", () => {
    expect(fileNameFromDisposition('attachment; filename="KW-001-v3-tech-pack.pdf"', "fallback.pdf")).toBe("KW-001-v3-tech-pack.pdf");
  });

  it("prefers the UTF-8 name when there is one, decoded", () => {
    expect(
      fileNameFromDisposition(`attachment; filename="Caf--7-v3-tech-pack.pdf"; filename*=UTF-8''Caf%C3%A9%207-v3-tech-pack.pdf`, "fallback.pdf"),
    ).toBe("Café 7-v3-tech-pack.pdf");
  });

  it("falls back when there is no header, no name, or a name that cannot be read", () => {
    expect(fileNameFromDisposition(null, "fallback.pdf")).toBe("fallback.pdf");
    expect(fileNameFromDisposition("attachment", "fallback.pdf")).toBe("fallback.pdf");
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''%E0%A4%A", "fallback.pdf")).toBe("fallback.pdf");
  });

  it("never gives a path, a control character or an empty name, whatever the header says", () => {
    for (const header of [
      'attachment; filename="../../etc/passwd"',
      'attachment; filename="..\\\\..\\\\x.exe"',
      "attachment; filename*=UTF-8''%2E%2E%2Fevil.pdf",
      "attachment; filename*=UTF-8''a%0D%0Ab.pdf",
      'attachment; filename=""',
      'attachment; filename="   "',
      "attachment; filename*=UTF-8''%E2%80%AEfdp.exe",
    ]) {
      const name = fileNameFromDisposition(header, "fallback.pdf");
      expect(name, header).not.toMatch(/[\\/\u0000-\u001f‮]/);
      expect(name.trim().length, header).toBeGreaterThan(0);
      expect(name, header).not.toMatch(/^\.+$/);
    }
  });
});

describe("what a failure says", () => {
  it("says the session ended, for no session", () => {
    expect(failureSentence(401, { success: false, error: { code: "unauthenticated", message: "Sign in to continue." } })).toBe(
      "Your session has ended. Sign in again to download this file.",
    );
    expect(failureSentence(403, { success: false, error: { code: "no_brand", message: "Create a brand first." } })).toBe(
      "Your session has ended. Sign in again to download this file.",
    );
  });

  it("says the design could not be found, in the words the server gave when it gave any", () => {
    expect(failureSentence(404, { success: false, error: { code: "not_found", message: "That design does not exist." } })).toBe("That design does not exist.");
    expect(failureSentence(404, { success: false, error: { code: "not_found", message: "There is no drawing for this garment type yet." } })).toBe(
      "There is no drawing for this garment type yet.",
    );
    expect(failureSentence(404, "<html>")).toBe("This design could not be found.");
  });

  it("says there were too many requests", () => {
    expect(failureSentence(429, { success: false, error: { code: "rate_limited", message: "Too many requests. Wait a moment and try again." } })).toBe(
      "Too many downloads. Wait a moment and try again.",
    );
  });

  it("says the file could not be built, for a failure on the server, and never repeats what the server said", () => {
    expect(failureSentence(500, { success: false, error: { code: "internal", message: "Something went wrong on our side. Try again." } })).toBe(
      "The file could not be built. Try again in a moment.",
    );
    expect(failureSentence(503, { success: false, error: { code: "unavailable", message: "stack trace at line 4" } })).toBe(
      "The file could not be built. Try again in a moment.",
    );
  });

  it("gives a plain sentence for anything else, and reveals nothing internal", () => {
    expect(failureSentence(400, { success: false, error: { code: "invalid_input", message: "Some fields need another look." } })).toBe(
      "The download did not work. Reload the page and try again.",
    );
    expect(failureSentence(418, null)).toBe("The download did not work. Reload the page and try again.");
    expect(failureSentence(0, undefined)).toBe("The download did not work. Reload the page and try again.");
  });
});

describe("the busy state", () => {
  it("starts with nothing busy, becomes busy with one download, and ignores a second press", () => {
    expect(isBusyWith(null, "pdf")).toBe(false);
    const busy = startDownload(null, "pdf");
    expect(busy).toBe("pdf");
    expect(startDownload(busy, "xlsx")).toBe("pdf");
    expect(isBusyWith(busy, "pdf")).toBe(true);
    expect(isBusyWith(busy, "xlsx")).toBe(false);
  });

  it("finishes only the download that was running", () => {
    expect(finishDownload("pdf", "pdf")).toBeNull();
    expect(finishDownload("pdf", "xlsx")).toBe("pdf");
    expect(finishDownload(null, "pdf")).toBeNull();
  });

  it("says in words what is being prepared, and says nothing when nothing is", () => {
    expect(busyAnnouncement(null)).toBe("");
    expect(busyAnnouncement("pdf")).toBe("Preparing the PDF. This can take a few seconds.");
    expect(busyAnnouncement("svg-back")).toBe("Preparing the back drawing. This can take a few seconds.");
  });
});

describe("downloading a file", () => {
  const OPTIONS = { version: 3 };

  it("gives the bytes and the name from the header when the answer is the file", async () => {
    const asked: string[] = [];
    const result = await downloadFile(PROJECT, PDF, OPTIONS, async (address) => {
      asked.push(address);
      return answerWith(200, "%PDF-1.7 ...", {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="KW-001-v3-tech-pack.pdf"',
      });
    });

    expect(asked).toEqual([`/api/projects/${PROJECT}/exports/pdf?version=3`]);
    expect(result).toMatchObject({ ok: true, name: "KW-001-v3-tech-pack.pdf" });
    expect(result.ok && (await result.blob.text())).toBe("%PDF-1.7 ...");
  });

  it("names a file that came with no name after the format", async () => {
    const result = await downloadFile(PROJECT, FRONT, OPTIONS, async () => answerWith(200, "<svg/>", { "content-type": "image/svg+xml; charset=utf-8" }));
    expect(result).toMatchObject({ ok: true, name: "tech-pack-front.svg" });
  });

  it("turns each kind of failure into a sentence", async () => {
    const failing = (status: number, body: unknown) => downloadFile(PROJECT, EXCEL, OPTIONS, async () => answerWith(status, body));
    expect(await failing(401, { success: false, error: { code: "unauthenticated", message: "Sign in to continue." } })).toEqual({
      ok: false,
      sentence: "Your session has ended. Sign in again to download this file.",
    });
    expect(await failing(429, { success: false, error: { code: "rate_limited", message: "x" } })).toMatchObject({ ok: false, sentence: "Too many downloads. Wait a moment and try again." });
    expect(await failing(500, { success: false, error: { code: "internal", message: "x" } })).toMatchObject({ ok: false, sentence: "The file could not be built. Try again in a moment." });
  });

  it("says the server could not be reached when the request itself fails", async () => {
    const result = await downloadFile(PROJECT, PDF, OPTIONS, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ ok: false, sentence: "We could not reach the server. Check your connection and try again." });
  });

  it("does not save a page that came back in place of the file, such as a sign-in page", async () => {
    const result = await downloadFile(PROJECT, PDF, OPTIONS, async () => answerWith(200, "<html>Sign in</html>", { "content-type": "text/html" }));
    expect(result).toEqual({ ok: false, sentence: "The download did not work. Reload the page and try again." });
  });
});
