"use client";

import { useEffect, useState } from "react";

/**
 * Плавный уход: после show = false элемент ещё `duration` мс остаётся на экране
 * с closing = true — чтобы успела проиграться анимация исчезновения.
 */
export function usePresence(show: boolean, duration: number) {
  const [mounted, setMounted] = useState(show);
  // Появление — сразу, в том же рендере (без лишнего кадра).
  if (show && !mounted) setMounted(true);

  useEffect(() => {
    if (show || !mounted) return;
    const t = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(t);
  }, [show, mounted, duration]);

  return { mounted: mounted || show, closing: mounted && !show };
}
