/**
 * The blurred thread-colour light that drifts behind the glass on every page. It is
 * decoration only: fixed behind the content, hidden from screen readers, still when the
 * person asks for less motion.
 */
export function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora hero-drift">
        <i style={{ width: "46%", height: "52%", left: "4%", top: "2%", background: "#2b46f0" }} />
        <i style={{ width: "34%", height: "40%", left: "58%", top: "10%", background: "#9fb0ff", opacity: 0.8 }} />
        <i style={{ width: "30%", height: "34%", left: "40%", top: "58%", background: "#ffd3e6", opacity: 0.35 }} />
        <i style={{ width: "28%", height: "30%", left: "78%", top: "62%", background: "#c7f0e4", opacity: 0.3 }} />
      </div>
    </div>
  );
}
