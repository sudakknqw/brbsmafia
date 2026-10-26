"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DayView } from "./DayView";
import type { CrewData } from "@/lib/views";
import { addDays, weekStart } from "@/lib/time";
import { haptic, telegram } from "@/lib/tg";

type OpenDay = (day: string, origin: HTMLElement | null, invite?: boolean) => void;
const DayOverlayContext = createContext<OpenDay | null>(null);

/** Opens a day over the home page, expanding it from the origin element. */
export function useOpenDay() {
  return useContext(DayOverlayContext);
}

// Smooth deceleration without a "hang" at the end, like iOS card expansion.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const FULL = "translate(0px, 0px) scale(1, 1)";
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The panel scaled exactly into the tile's rectangle (transform from the top-left corner).
 * This used to be clip-path, but on iPhone it repainted the whole screen every frame
 * and the expansion stuttered; transform runs on the GPU without repainting.
 */
function tileTransform(el: HTMLElement | null) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = el?.getBoundingClientRect() ?? { left: w * 0.1, top: h * 0.3, width: w * 0.8, height: h * 0.4 };
  return `translate(${r.left}px, ${r.top}px) scale(${Math.max(r.width / w, 0.01)}, ${Math.max(r.height / h, 0.01)})`;
}

/**
 * Expanding day: the tile grows to full screen (transform)
 * and collapses back into it on close. The URL doesn't change, but a history
 * entry is pushed, so Back in the browser or on the phone closes the day.
 */
export function DayOverlayProvider({ data, children }: { data: CrewData; children: ReactNode }) {
  const [day, setDay] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [openSeq, setOpenSeq] = useState(0); // increments on every open and triggers the expansion
  const [dir, setDir] = useState<1 | -1 | 0>(0); // paging direction, for the slide animation
  const panel = useRef<HTMLDivElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const closing = useRef(false);
  const pushed = useRef(false);

  const animateClose = useCallback(() => {
    const el = panel.current;
    if (!el || closing.current) return;
    closing.current = true;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      closing.current = false;
      setDay(null);
      origin.current?.focus({ preventScroll: true });
    };
    if (reduceMotion()) return done();
    // The tile may have scrolled out of the week row (it scrolls sideways on phones).
    origin.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    // Content fades out, the panel shrinks into the tile and dissolves into it at the very end.
    el.firstElementChild?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 480, fill: "forwards" });
    el.animate([{ transform: FULL }, { transform: tileTransform(origin.current) }], {
      duration: 480,
      easing: EASE,
      fill: "forwards",
    }).onfinish = done;
    // Safety net: a background tab may never finish the animation.
    setTimeout(done, 700);
  }, []);

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back(); // the popstate handler below runs the animation
    } else animateClose();
  }, [animateClose]);

  const open = useCallback<OpenDay>((d, el, withInvite = false) => {
    origin.current = el;
    setInvite(withInvite);
    setDir(0);
    setDay(d);
    setOpenSeq((n) => n + 1);
    // Keep the URL: only a history entry, so that Back closes the day.
    history.pushState({ ...history.state, brbsDay: d }, "", location.href);
    pushed.current = true;
  }, []);

  // Expand before the panel's first paint (useLayoutEffect); otherwise it showed full screen
  // for one frame before starting to grow from the tile.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!openSeq || !el) return;
    el.scrollTop = 0;
    if (reduceMotion()) return;
    // The panel grows from the tile (it's just a dark background, so the stretch is invisible),
    // and the content fades in when the panel is almost open, sliding in slightly.
    el.animate([{ transform: tileTransform(origin.current) }, { transform: FULL }], { duration: 680, easing: EASE });
    el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 1 }], { duration: 680 });
    el.firstElementChild?.animate(
      [
        { transform: "scale(0.97)", opacity: 0 },
        { transform: "scale(0.98)", opacity: 0, offset: 0.2 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 680, easing: EASE },
    );
  }, [openSeq]);

  // Neighbouring days stay within the current week (its data is already loaded by the home page).
  const monday = weekStart(data.today);
  const inWeek = (d: string) => d >= monday && d <= addDays(monday, 6);
  const prevDay = day && inWeek(addDays(day, -1)) ? addDays(day, -1) : null;
  const nextDay = day && inWeek(addDays(day, 1)) ? addDays(day, 1) : null;
  const go = useCallback((d: string | null, to: 1 | -1) => {
    if (!d) return;
    haptic("select");
    // Now we must close into this day's tile, not the one we opened from.
    origin.current = document.querySelector<HTMLElement>(`a.tile[href="/day/${d}"]`) ?? origin.current;
    setDir(to);
    setInvite(false);
    setDay(d);
    panel.current?.scrollTo({ top: 0 });
  }, []);

  // Inside Telegram the day uses the native Back button in the app header.
  useEffect(() => {
    const app = telegram();
    if (!app || !day) return;
    app.BackButton.show();
    app.BackButton.onClick(close);
    return () => {
      app.BackButton.offClick(close);
      app.BackButton.hide();
    };
  }, [day, close]);

  // A link from a reminder (/?day=2026-10-10) opens that day right away.
  useEffect(() => {
    const url = new URL(window.location.href);
    const wanted = url.searchParams.get("day");
    if (!wanted || !/^\d{4}-\d{2}-\d{2}$/.test(wanted)) return;
    url.searchParams.delete("day");
    history.replaceState(history.state, "", url.pathname + url.search);
    const timer = setTimeout(() => open(wanted, null));
    return () => clearTimeout(timer);
  }, [open]);

  // Back button: close with the animation.
  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      animateClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [animateClose]);

  // While the day is open the home page underneath doesn't scroll; Esc closes it.
  useEffect(() => {
    if (!day) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-day])')) return; // a sheet is open
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") go(prevDay, -1);
      if (e.key === "ArrowRight") go(nextDay, 1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [day, close, go, prevDay, nextDay]);

  return (
    <DayOverlayContext.Provider value={open}>
      {children}
      {day && (
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="День"
          data-day
          className="fixed inset-0 z-40 origin-top-left overflow-x-hidden overflow-y-auto overscroll-contain bg-ink"
          style={{ ["--base" as string]: "0.22s" }}
        >
          <div>
            <div key={day} className={dir === 1 ? "anim-from-right" : dir === -1 ? "anim-from-left" : ""}>
              <DayView
                data={data}
                day={day}
                onClose={close}
                invite={invite}
                prevDay={prevDay}
                nextDay={nextDay}
                onGo={(d, to) => go(d, to)}
              />
            </div>
          </div>
        </div>
      )}
    </DayOverlayContext.Provider>
  );
}
