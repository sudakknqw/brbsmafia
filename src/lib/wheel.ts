/**
 * Ref для горизонтального ряда: колёсико мыши (вверх-вниз) листает его вбок.
 * Когда ряд упёрся в край — прокрутка достаётся странице, как обычно.
 * Тачпад с горизонтальным жестом не трогаем: он и так листает вбок.
 */
export function wheelToX(el: HTMLElement | null) {
  if (!el) return;
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  };
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => el.removeEventListener("wheel", onWheel);
}
