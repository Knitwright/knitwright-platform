import { describe, expect, it, vi } from "vitest";
import { markBagPacked, setBags, setCarton } from "./service";

describe("packing writes", () => {
  it("send the actor and what was typed, null where nothing was", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null });
    expect(await setBags({ rpc } as never, "actor", "o", "t", [{ teamRowPosition: 1, sizeLabel: "M", pieces: 1 }, { teamRowPosition: null, sizeLabel: "L", pieces: 1 }])).toBe(2);
    await setCarton({ rpc } as never, "actor", "o", { cartonNo: 1, weightG: null, lengthMm: 400, widthMm: null, heightMm: null });
    await markBagPacked({ rpc } as never, "actor", "b", 1);
    expect(rpc).toHaveBeenNthCalledWith(2, "ops_set_carton", { p_actor: "actor", p_order_id: "o", p_carton_no: 1, p_weight_g: null, p_length_mm: 400, p_width_mm: null, p_height_mm: null });
    expect(rpc).toHaveBeenNthCalledWith(3, "ops_mark_bag_packed", { p_actor: "actor", p_bag_id: "b", p_carton_no: 1 });
  });

  it("explain a refusal", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "raw", hint: "already_packing" } });
    await expect(setBags({ rpc } as never, "actor", "o", null, [])).rejects.toThrow(/cannot be remade/);
  });
});
