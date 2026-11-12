import "server-only";
import { sessionClient } from "@/lib/server/deps";
import { readLengthUnit, type GarmentUnit } from "./preference";

/** The signed-in person's garment unit, read with their own client (decision 0144). */
export async function preferredLengthUnit(userId: string): Promise<GarmentUnit> {
  return readLengthUnit(await sessionClient(), userId);
}
