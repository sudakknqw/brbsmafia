"use client";

import { useEffect, useState } from "react";

/**
 * Smooth exit: after show = false the element stays on screen for `duration` ms
 * with closing = true, so the exit animation has time to play.
 */
export function usePresence(show: boolean, duration: number) {
  const [mounted, setMounted] = useState(show);
  // Appearing is immediate, in the same render (no extra frame).
  if (show && !mounted) setMounted(true);

  useEffect(() => {
    if (show || !mounted) return;
    const t = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(t);
  }, [show, mounted, duration]);

  return { mounted: mounted || show, closing: mounted && !show };
}
