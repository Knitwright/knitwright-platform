import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { devRoutesEnabled } from "../dev-routes";
import { Gallery } from "./Gallery";

export const metadata: Metadata = {
  title: "Component library",
  robots: { index: false, follow: false },
};

/**
 * Every component of docs/spec/10-design-system.md in every state (§11: "reachable in Storybook
 * or a fixture route"). It reads no data and needs no session; a production build answers 404
 * unless DEV_UI_ROUTES is "on".
 */
export default async function DevUiPage() {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  return <Gallery />;
}
