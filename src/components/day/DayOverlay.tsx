"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { DayView } from "./DayView";
import type { CrewData } from "@/lib/views";

type OpenDay = (day: string, origin: HTMLElement | null, invite?: boolean) => void;
const DayOverlayContext = createContext<OpenDay | null>(null);

/** Открыть день поверх главной, раскрыв его из элемента origin. */
export function useOpenDay() {
  return useContext(DayOverlayContext);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EASE_OPEN = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_CLOSE = "cubic-bezier(0.4, 0, 0.2, 1)";
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Прямоугольник элемента как clip-path относительно окна. */
function clipFrom(el: HTMLElement | null) {
  if (!el) return "inset(30% 10% 30% 10% round 28px)";
  const r = el.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16;
  return `inset(${r.top}px ${w - r.right}px ${h - r.bottom}px ${r.left}px round ${radius}px)`;
}

/**
 * Раскрывающийся день: плитка растягивается на весь экран (clip-path),
 * а при закрытии сворачивается обратно в неё. День пишется в адрес после #
 * (/#2026-10-10): «Назад» закрывает его, а обновление данных страницы
 * не уводит на отдельный /day/… — Next смотрит только на путь, не на #.
 */
export function DayOverlayProvider({ data, children }: { data: CrewData; children: ReactNode }) {
  const [day, setDay] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
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
    // Содержимое гаснет, а сама панель сворачивается обратно в плитку.
    el.firstElementChild?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "forwards" });
    el.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: clipFrom(origin.current) }], {
      duration: 420,
      easing: EASE_CLOSE,
      fill: "forwards",
    }).onfinish = done;
    // Страховка: в фоновой вкладке браузер может не доиграть анимацию.
    setTimeout(done, 600);
  }, []);

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back(); // popstate ниже запустит анимацию
    } else {
      history.replaceState(history.state, "", location.pathname + location.search);
      animateClose();
    }
  }, [animateClose]);

  const open = useCallback<OpenDay>((d, el, withInvite = false) => {
    origin.current = el;
    setInvite(withInvite);
    setDay(d);
    history.pushState(history.state, "", `#${d}`);
    pushed.current = true;
  }, []);

  // Раскрытие — сразу после монтирования панели.
  useEffect(() => {
    const el = panel.current;
    if (!day || !el) return;
    el.scrollTop = 0;
    if (reduceMotion()) return;
    el.animate([{ clipPath: clipFrom(origin.current) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], {
      duration: 620,
      easing: EASE_OPEN,
    });
  }, [day]);

  // Открыли страницу сразу с днём в адресе (обновили страницу) — показываем его.
  useEffect(() => {
    const fromHash = location.hash.slice(1);
    if (!DATE.test(fromHash)) return;
    const timer = setTimeout(() => setDay(fromHash));
    return () => clearTimeout(timer);
  }, []);

  // Кнопка «Назад»: закрываем с анимацией.
  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
      animateClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [animateClose]);

  // Пока день открыт, главная под ним не прокручивается; Esc закрывает.
  useEffect(() => {
    if (!day) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-day])')) close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [day, close]);

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
          className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto overscroll-contain bg-ink"
          style={{ ["--base" as string]: "0.22s" }}
        >
          <div>
            <DayView data={data} day={day} onClose={close} invite={invite} />
          </div>
        </div>
      )}
    </DayOverlayContext.Provider>
  );
}
