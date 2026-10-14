import { ARTWORK_LIMITS } from "../limits";
import { refuse, REFUSALS } from "./refuse";

const LIMITS = ARTWORK_LIMITS.vector;

/**
 * The allowance for reading one file: elements, path commands and time. Every parser loop ticks it, so a
 * hostile file stops at the first limit it reaches. The reader is plain code with no way to reach a file
 * or the network; the time limit is checked cooperatively.
 */
export class Budget {
  private elements = 0;
  private commands = 0;
  private ticks = 0;
  private readonly deadline: number;

  constructor(now: () => number = Date.now, private readonly clock = now) {
    this.deadline = clock() + LIMITS.maxParseMs;
  }

  element(depth: number): void {
    this.elements += 1;
    if (this.elements > LIMITS.maxElements) refuse(REFUSALS.tooComplex);
    if (depth > LIMITS.maxDepth) refuse(REFUSALS.tooDeep);
    this.tick();
  }

  pathCommands(count: number): void {
    this.commands += count;
    if (this.commands > LIMITS.maxPathCommands) refuse(REFUSALS.tooComplex);
    this.tick();
  }

  /** Called inside long loops. The clock is read once every 256 calls. */
  tick(): void {
    this.ticks += 1;
    if (this.ticks % 256 === 0 && this.clock() > this.deadline) refuse(REFUSALS.tooSlow);
  }
}
