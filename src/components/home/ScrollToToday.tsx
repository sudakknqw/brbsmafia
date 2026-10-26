"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** On narrow screens the week doesn't fit, so scroll today's tile into view. */
export function ScrollToToday({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const today = box?.querySelector<HTMLElement>("[data-today]");
    if (!box || !today) return;
    const left = today.offsetLeft - box.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft);
    if (left + today.offsetWidth > box.clientWidth) box.scrollLeft = left;
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
