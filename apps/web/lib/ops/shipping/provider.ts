/**
 * Where a parcel's details come from. No courier is called (owner decision pending, decision 0050, question Q4):
 * the only provider is `manual`, which hands back exactly what ops typed. A courier that books labels would
 * implement the same interface and return the number it was given.
 */
export interface ParcelRequest {
  readonly courier: string;
  readonly trackingNumber: string;
}

export interface Parcel {
  readonly provider: "manual";
  readonly courier: string;
  readonly trackingNumber: string;
  /** A link to the courier's tracking page, or null: the manual provider knows none and invents none. */
  readonly trackingUrl: string | null;
}

export interface ShippingProvider {
  readonly id: "manual";
  readonly describe: string;
  prepare(request: ParcelRequest): Promise<Parcel>;
}

export const manualProvider: ShippingProvider = {
  id: "manual",
  describe: "Entered by hand. Nothing is sent to a courier.",
  prepare: async ({ courier, trackingNumber }) => ({ provider: "manual", courier: courier.trim(), trackingNumber: trackingNumber.trim(), trackingUrl: null }),
};
