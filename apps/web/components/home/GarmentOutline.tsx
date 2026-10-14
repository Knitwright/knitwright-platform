/** A plain garment outline, for a design whose garment has no drawing. */
export function GarmentOutline() {
  return (
    <svg className="lift-art" width="96" height="104" viewBox="0 0 96 104" aria-hidden="true" focusable="false">
      <path
        d="M30 4 L18 8 L2 30 L16 40 L22 32 L22 100 L74 100 L74 32 L80 40 L94 30 L78 8 L66 4 Q48 18 30 4 Z"
        fill="rgba(233,234,238,0.08)"
        stroke="rgba(255,255,255,0.4)"
      />
      <path d="M30 4 Q48 18 66 4" fill="none" stroke="var(--cobalt-soft)" strokeWidth="4" />
    </svg>
  );
}
