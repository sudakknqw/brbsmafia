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

// Плавное торможение без «зависания» в конце, как у раскрытия карточек в iOS.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const FULL = "inset(0px 0px 0px 0px round 0px)";
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
 * а при закрытии сворачивается обратно в неё. Адрес не меняется, но в истории
 * появляется шаг — «Назад» в браузере или на телефоне закрывает день.
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
    // Содержимое уходит, панель сворачивается в плитку и в самом конце растворяется в ней.
    el.firstElementChild?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], { duration: 480, fill: "forwards" });
    el.animate([{ clipPath: FULL }, { clipPath: clipFrom(origin.current) }], {
      duration: 480,
      easing: EASE,
      fill: "forwards",
    }).onfinish = done;
    // Страховка: в фоновой вкладке браузер может не доиграть анимацию.
    setTimeout(done, 700);
  }, []);

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      history.back(); // popstate ниже запустит анимацию
    } else animateClose();
  }, [animateClose]);

  const open = useCallback<OpenDay>((d, el, withInvite = false) => {
    origin.current = el;
    setInvite(withInvite);
    setDay(d);
    // Адрес не меняем: только запись в истории, чтобы «Назад» закрывал день.
    history.pushState({ ...history.state, brbsDay: d }, "", location.href);
    pushed.current = true;
  }, []);

  // Раскрытие — сразу после монтирования панели.
  useEffect(() => {
    const el = panel.current;
    if (!day || !el) return;
    el.scrollTop = 0;
    if (reduceMotion()) return;
    // Панель вырастает из плитки, а содержимое чуть «подъезжает» навстречу.
    el.animate([{ clipPath: clipFrom(origin.current) }, { clipPath: FULL }], { duration: 680, easing: EASE });
    el.animate([{ opacity: 0.5 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }], { duration: 680 });
    el.firstElementChild?.animate([{ transform: "scale(0.96)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], {
      duration: 680,
      easing: EASE,
    });
  }, [day]);

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
