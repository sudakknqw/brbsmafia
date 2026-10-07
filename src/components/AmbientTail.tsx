/**
 * Отсвет цвета игры на стыке арта и страницы. Ставится парой: низ шапки
 * (edge="bottom") и верх контента — так на границе цвет совпадает и шва нет.
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
