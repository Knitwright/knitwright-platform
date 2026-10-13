/** What an action removed or changed on the way, so a screen can tell the person. */
export type DroppedKind =
  | "option"
  | "measurement"
  | "colour"
  | "fabric-assignment"
  | "fabric-change"
  | "artwork"
  | "names-numbers"
  | "kit-pattern"
  | "component"
  | "construction";

export interface Dropped {
  readonly kind: DroppedKind;
  /** Identifies the thing. For a colour or a fabric assignment this is the panel id. */
  readonly id: string;
  /** For a colour, the id of the colourway it was in. */
  readonly parentId?: string;
  /** One plain sentence. */
  readonly message: string;
}
