import { describe, expect, it, vi } from "vitest";
import { LOGO_RIGHTS_MISSING } from "@/lib/storage/rights";
import {
  LOGO_RIGHTS_WAITING,
  checkUploadFile,
  logoStep,
  uploadArtworkFile,
  uploadImageFile,
  UPLOAD_MAX_BYTES,
} from "./artwork-upload";

const FILE_ID = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";
const png = (size = 1000) => new File([new Uint8Array(size)], "logo.png", { type: "image/png" });

const reply = (body: unknown, status = 200) => async () => Response.json(body, { status });

describe("logoStep", () => {
  it("keeps a logo chosen before the box is ticked, and asks for the tick", () => {
    expect(logoStep(png(), false)).toBe("wait-for-rights");
    expect(LOGO_RIGHTS_WAITING).toMatch(/Your file is kept/);
  });

  it("uploads the kept logo once the box is ticked", () => {
    expect(logoStep(png(), true)).toBe("upload");
  });

  it("does nothing without a file", () => {
    expect(logoStep(null, true)).toBe("nothing");
    expect(logoStep(null, false)).toBe("nothing");
  });
});

describe("checkUploadFile", () => {
  it("lets a PNG, a JPEG and a WebP through", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) expect(checkUploadFile({ type, size: 100 })).toBeNull();
  });

  it("says plainly what is wrong with a file that is not a picture, is empty or is too big", () => {
    expect(checkUploadFile({ type: "application/pdf", size: 100 })).toBe("Upload a PNG, JPEG or WebP image.");
    expect(checkUploadFile({ type: "image/svg+xml", size: 100 })).toBe("Upload a PNG, JPEG or WebP image.");
    expect(checkUploadFile({ type: "image/png", size: 0 })).toBe("That file is empty. Choose another.");
    expect(checkUploadFile({ type: "image/png", size: UPLOAD_MAX_BYTES + 1 })).toBe("Images can be 8 MB at most.");
    expect(checkUploadFile({ type: "image/png", size: UPLOAD_MAX_BYTES })).toBeNull();
  });
});

describe("uploadArtworkFile", () => {
  it("sends the file as artwork and returns its id and shape", async () => {
    const post = vi.fn(async (form: FormData) => (form.get("kind") === null ? new Response(null, { status: 400 }) : Response.json({ success: true, data: { id: FILE_ID, width: 400, height: 200, kind: "artwork" } })));
    const result = await uploadArtworkFile(png(), post, true);
    expect(result).toEqual({ ok: true, fileId: FILE_ID, width: 400, height: 200 });
    const form = post.mock.calls[0]?.[0] as FormData;
    expect(form.get("kind")).toBe("artwork");
    expect(form.get("file")).toBeInstanceOf(File);
    expect(form.get("rights")).toBe("yes");
  });

  it("sends nothing until the person confirms they may use the logo", async () => {
    const post = vi.fn(reply({}));
    expect(await uploadArtworkFile(png(), post, false)).toEqual({ ok: false, reason: LOGO_RIGHTS_MISSING });
    expect(post).not.toHaveBeenCalled();
  });

  it("does not send a file that fails the check", async () => {
    const post = vi.fn(reply({}));
    const result = await uploadArtworkFile(new File(["x"], "a.txt", { type: "text/plain" }), post, true);
    expect(result).toEqual({ ok: false, reason: "Upload a PNG, JPEG or WebP image." });
    expect(post).not.toHaveBeenCalled();
  });

  it("passes on the server's own sentence when it refuses the file", async () => {
    const post = reply({ success: false, error: { code: "invalid_input", message: "That file could not be read as an image." } }, 400);
    expect(await uploadArtworkFile(png(), post, true)).toEqual({ ok: false, reason: "That file could not be read as an image." });
  });

  it("says the same plain thing when the answer cannot be understood", async () => {
    const message = "The upload did not work. Try again.";
    expect(await uploadArtworkFile(png(), reply({ nonsense: true }), true)).toEqual({ ok: false, reason: message });
    expect(await uploadArtworkFile(png(), async () => new Response("<html>", { status: 502 }), true)).toEqual({ ok: false, reason: message });
    expect(await uploadArtworkFile(png(), reply({ success: true, data: { id: "not-an-id", width: 1, height: 1 } }), true)).toEqual({ ok: false, reason: message });
  });

  it("says the connection failed when nothing comes back", async () => {
    const post = async () => {
      throw new Error("offline");
    };
    expect(await uploadArtworkFile(png(), post, true)).toEqual({ ok: false, reason: "We could not reach the server. Check your connection and try again." });
  });
});

describe("uploadImageFile", () => {
  it("sends a sketch or a photo through the same upload route, named as such", async () => {
    let sent: FormData | undefined;
    const result = await uploadImageFile(png(), "sketch", async (form) => {
      sent = form;
      return Response.json({ success: true, data: { id: FILE_ID, width: 10, height: 20 } });
    });
    expect(result).toEqual({ ok: true, fileId: FILE_ID, width: 10, height: 20 });
    expect(sent?.get("kind")).toBe("sketch");
    expect(sent?.get("rights")).toBeNull();
  });
});
