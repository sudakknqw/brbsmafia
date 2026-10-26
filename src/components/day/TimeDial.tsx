"use client";

import { useRef } from "react";
import { DAY_HOURS, DAY_START_HOUR } from "@/lib/time";
import { haptic } from "@/lib/tg";
import { plural } from "@/lib/words";

type Range = [number, number];

// Dial geometry (in viewBox units).
const SIZE = 300;
const C = SIZE / 2;
const R = 106; // ring radius
const RING = 26; // ring thickness
const HEAT = R - RING / 2 - 9; // inner "who else is free" ring
const LABELS = R + RING / 2 + 16;

/**
 * Hour boundary k (0…24 from the start of the gaming day) → angle on the dial.
 * Midnight at the top, noon at the bottom, clockwise; the gaming day starts at 08:00.
 */
const angleOf = (k: number) => (((DAY_START_HOUR + k) % 24) / 24) * Math.PI * 2;
const point = (k: number, r: number) => {
  const a = angleOf(k);
  return [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
};

/** Arc along the ring from boundary a to boundary b (clockwise). */
function arc(a: number, b: number, r: number) {
  if (b - a >= DAY_HOURS) return `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - 0.01} ${C - r}`;
  const [x1, y1] = point(a, r);
  const [x2, y2] = point(b, r);
  const large = (b - a) / DAY_HOURS > 0.5 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * 24-hour dial for phones: two handles mark the start and end of free time.
 * You can grab any point of the ring and the nearest handle moves. Handles never jump across
 * 08:00 (the gaming-day boundary). The inner ring is brighter where others are free.
 */
export function TimeDial({
  value,
  onChange,
  hourLabels,
  others,
}: {
  value: Range;
  onChange: (r: Range) => void;
  hourLabels: string[];
  /** How many others are free in each hour of the day. */
  others: number[];
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<"start" | "end" | null>(null);
  const [a, b] = value;
  const maxOthers = Math.max(1, ...others);

  /** Pointer position → hour boundary (fractional, 0…24 from the start of the gaming day). */
  const boundaryAt = (e: React.PointerEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    const clock = ((Math.atan2(x, -y) / (Math.PI * 2)) * 24 + 24) % 24;
    return (clock - DAY_START_HOUR + 24) % 24;
  };

  const move = (e: React.PointerEvent) => {
    const which = dragging.current;
    if (!which) return;
    let k = Math.round(boundaryAt(e));
    let next: Range;
    if (which === "start") {
      k %= DAY_HOURS;
      if (Math.abs(k - a) > DAY_HOURS / 2) k = a < DAY_HOURS / 2 ? 0 : DAY_HOURS - 1; // never across 08:00
      next = [k, Math.max(b, k + 1)];
    } else {
      if (k === 0) k = DAY_HOURS;
      if (Math.abs(k - b) > DAY_HOURS / 2) k = b > DAY_HOURS / 2 ? DAY_HOURS : 1;
      next = [Math.min(a, k - 1), k];
    }
    if (next[0] !== a || next[1] !== b) {
      haptic("select");
      onChange(next);
    }
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    // The handle closest to the pointer (around the circle).
    const k = boundaryAt(e);
    const dist = (x: number) => Math.min(Math.abs(k - x), DAY_HOURS - Math.abs(k - x));
    dragging.current = dist(a % DAY_HOURS) <= dist(b % DAY_HOURS) ? "start" : "end";
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // the finger may leave the circle; keep dragging anyway
    } catch {}
    move(e);
  };

  const [sx, sy] = point(a, R);
  const [ex, ey] = point(b, R);
  const [seamIn, seamOut] = [point(0, R - RING / 2 - 3), point(0, R + RING / 2 + 3)];
  const hours = b - a;

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block w-full max-w-[min(290px,42dvh)] touch-none select-none"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => (dragging.current = null)}
      onPointerCancel={() => (dragging.current = null)}
      role="group"
      aria-label={`Свободен ${hourLabels[a]} – ${hourLabels[b]}`}
    >
      {/* Ring */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth={RING} />

      {/* Who else is free: the brighter the tick, the more friends that hour */}
      {others.map((n, i) =>
        n > 0 ? (
          <path
            key={i}
            d={arc(i + 0.08, i + 0.92, HEAT)}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.15 + (0.6 * n) / maxOthers}
            strokeWidth={5}
            strokeLinecap="round"
          />
        ) : null,
      )}

      {/* Hour labels: every third hour */}
      {Array.from({ length: 8 }, (_, i) => i * 3).map((clock) => {
        const k = (clock - DAY_START_HOUR + 24) % 24;
        const [x, y] = point(k, LABELS);
        return (
          <text key={clock} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fill="rgb(244 244 246 / 0.45)">
            {clock}
          </text>
        );
      })}

      {/* My time */}
      <path d={arc(a, b, R)} fill="none" stroke="#f4f4f6" strokeWidth={RING} strokeLinecap="round" />

      {/* Gaming-day boundary, 08:00 */}
      <line x1={seamIn[0]} y1={seamIn[1]} x2={seamOut[0]} y2={seamOut[1]} stroke="#050507" strokeWidth={3} />

      {/* Handles */}
      {[
        [sx, sy],
        [ex, ey],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={15} fill="#050507" stroke="#f4f4f6" strokeWidth={4} />
      ))}

      {/* Center */}
      <text x={C} y={C - 6} textAnchor="middle" fontSize={20} fontWeight={700} fill="#f4f4f6" style={{ fontVariantNumeric: "tabular-nums" }}>
        {hourLabels[a]} – {hourLabels[b]}
      </text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize={15} fill="rgb(244 244 246 / 0.6)">
        {hours} {plural(hours, "час", "часа", "часов")}
      </text>
    </svg>
  );
}
