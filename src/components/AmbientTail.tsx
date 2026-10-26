/**
 * Glow of the game color where the art meets the page. Used in pairs: bottom of the header
 * (edge="bottom") and top of the content, so the colors match at the boundary and there's no seam.
 */
export function AmbientTail({ edge = "top" }: { edge?: "top" | "bottom" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 h-[45vh] ${edge === "top" ? "top-0 left-1/2 w-screen -translate-x-1/2" : "inset-x-0 bottom-0"}`}
      style={{ background: `linear-gradient(to ${edge === "top" ? "bottom" : "top"}, rgb(var(--ambient) / 0.3), transparent)` }}
    />
  );
}
