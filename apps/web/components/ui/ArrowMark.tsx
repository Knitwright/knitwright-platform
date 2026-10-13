/** The small diagonal arrow inside the call-to-action disc. */
export function ArrowMark({ size = 12 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3 11 L11 3 M5 3 H11 V9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
