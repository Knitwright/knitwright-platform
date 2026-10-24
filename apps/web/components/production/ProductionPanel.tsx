import { FabricPanel } from "./fabrics/FabricPanel";
import { OrderPanel } from "./orders/OrderPanel";
import { PatternsPanel } from "./patterns/PatternsPanel";
import { PrintPanel } from "./print/PrintPanel";
import { ValidationPanel } from "./validation/ValidationPanel";

/**
 * The "Make it" panel: what it takes to get a design made, in four parts, led by the factory file's readiness list. Each part is a
 * component in its own folder, so the workstreams that build them never edit the same file.
 */
export function ProductionPanel() {
  return (
    <div className="flex flex-col gap-6" data-testid="production-panel">
      <ValidationPanel />
      <PatternsPanel />
      <FabricPanel />
      <PrintPanel />
      <OrderPanel />
    </div>
  );
}
