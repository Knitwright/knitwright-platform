import { describe, expect, it } from "vitest";
import { svgOf } from "../fixtures/svgs";
import { intakeVector } from "./index";

const read = (inner: string) => intakeVector(new TextEncoder().encode(svgOf(inner)), "svg").then((r) => r.doc);

describe("gradients", () => {
  it("defaults a linear gradient to left to right across the shape", async () => {
    const doc = await read(`<linearGradient id="a"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><rect width="40" height="20" x="10" y="5" fill="url(#a)"/>`);
    expect(doc.gradients[0]).toMatchObject({ type: "linear", x1: 0, y1: 0, x2: 1, y2: 0, m: [40, 0, 0, 20, 10, 5] });
  });

  it("reads percentages in user space and a focal point on a radial gradient", async () => {
    const doc = await read(`
      <linearGradient id="u" gradientUnits="userSpaceOnUse" x1="10%" x2="90%"><stop offset="0" stop-color="red"/></linearGradient>
      <radialGradient id="r" cx="0.4" cy="0.6" r="0.3" fx="0.2" fy="0.1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></radialGradient>
      <rect width="100" height="50" fill="url(#u)"/>
      <rect width="100" height="50" fill="url(#r)"/>`);
    expect(doc.gradients.find((g) => g.type === "linear")).toMatchObject({ x1: 10, x2: 90, y1: 0, y2: 0 });
    expect(doc.gradients.find((g) => g.type === "radial")).toMatchObject({ cx: 0.4, cy: 0.6, r: 0.3, fx: 0.2, fy: 0.1 });
  });

  it("uses a radial gradient's reach and centre in user space when none are given", async () => {
    const doc = await read(`<radialGradient id="r" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="red"/></radialGradient><rect width="100" height="50" fill="url(#r)"/>`);
    expect(doc.gradients[0]).toMatchObject({ type: "radial", cx: 50, cy: 25 });
  });

  it("reuses one gradient for the same shape size and makes another for a different box", async () => {
    const doc = await read(`
      <linearGradient id="a"><stop offset="0" stop-color="red"/></linearGradient>
      <rect width="10" height="10" fill="url(#a)"/><rect width="10" height="10" fill="url(#a)" x="0"/><rect width="20" height="10" fill="url(#a)"/>`);
    expect(doc.gradients).toHaveLength(2);
  });

  it("leaves out a bounding box gradient on a shape of no width, and a gradient that points at itself", async () => {
    const doc = await read(`
      <linearGradient id="a" href="#a"><stop offset="0" stop-color="red"/></linearGradient>
      <line x1="0" y1="0" x2="0" y2="10" stroke="url(#a)"/>
      <rect width="4" height="4"/>`);
    expect(doc.gradients).toHaveLength(0);
    expect(doc.nodes).toHaveLength(2);
  });

  it("keeps stop offsets from running backwards", async () => {
    const doc = await read(`<linearGradient id="a"><stop offset="0.6" stop-color="red"/><stop offset="0.2" stop-color="blue"/></linearGradient><rect width="9" height="9" fill="url(#a)"/>`);
    expect(doc.gradients[0].stops.map((s) => s.offset)).toEqual([0.6, 0.6]);
  });
});
