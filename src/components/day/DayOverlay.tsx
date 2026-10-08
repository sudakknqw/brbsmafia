"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DayView } from "./DayView";
import type { CrewData } from "@/lib/views";
import { addDays, weekStart } from "@/lib/time";
import { haptic, telegram } from "@/lib/tg";

type OpenDay = (day: string, origin: HTMLElement | null, invite?: boolean) => void;
const DayOverlayContext = createContext<OpenDay | null>(null);

/** Открыть день поверх главной, раскрыв его из элемента origin. */
export function useOpenDay() {
  return useContext(DayOverlayContext);
}

// Плавное торможение без «зависания» в конце, как у раскрытия карточек в iOS.
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const FULL = "translate(0px, 0px) scale(1, 1)";
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Панель, ужатая точно в прямоугольник плитки (transform от левого верхнего угла).
 * Раньше это был clip-path, но на iPhone он перерисовывал весь экран на каждом кадре
 * и раскрытие дёргалось; transform двигает видеокарта, без перерисовки.
 */
function tileTransform(el: HTMLElement | null) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = el?.getBoundingClientRect() ?? { left: w * 0.1, top: h * 0.3, width: w * 0.8, height: h * 0.4 };
  return `translate(${r.left}px, ${r.top}px) scale(${Math.max(r.width / w, 0.01)}, ${Math.max(r.height / h, 0.01)})`;
}

/**
 * Раскрывающийся день: плитка растягивается на весь экран (transform),
 * а при закрытии сворачивается обратно в неё. Адрес не меняется, но в истории
 * появляется шаг — «Назад» в браузере или на телефоне закрывает день.
 */
export function DayOverlayProvider({ data, children }: { data: CrewData; children: ReactNode }) {
  const [day, setDay] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [openSeq, setOpenSeq] = useState(0); // растёт при каждом открытии — запускает раскрытие
  const [dir, setDir] = useState<1 | -1 | 0>(0); // куда листали дни: для анимации сдвига
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
    // Плитка могла уехать за край ряда недели (на телефоне он листается вбок).
    origin.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    // Содержимое уходит, панель сворачивается в плитку и в самом конце растворяется в ней.
    el.firstElementChild?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
    el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 480, fill: "forwards" });
    el.animate([{ transform: FULL }, { transform: tileTransform(origin.current) }], {
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
    setDir(0);
    setDay(d);
    setOpenSeq((n) => n + 1);
    // Адрес не меняем: только запись в истории, чтобы «Назад» закрывал день.
    history.pushState({ ...history.state, brbsDay: d }, "", location.href);
    pushed.current = true;
  }, []);

  // Раскрытие — до первой отрисовки панели (useLayoutEffect): иначе она на кадр
  // показывалась на весь экран и только потом начинала расти из плитки.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!openSeq || !el) return;
    el.scrollTop = 0;
    if (reduceMotion()) return;
    // Панель вырастает из плитки (сама по себе она просто тёмный фон — её растяжение не видно),
    // а содержимое проявляется, когда панель уже почти раскрылась, и чуть «подъезжает» навстречу.
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

  // Соседние дни — в пределах текущей недели (её данные уже загружены главной).
  const monday = weekStart(data.today);
  const inWeek = (d: string) => d >= monday && d <= addDays(monday, 6);
  const prevDay = day && inWeek(addDays(day, -1)) ? addDays(day, -1) : null;
  const nextDay = day && inWeek(addDays(day, 1)) ? addDays(day, 1) : null;
  const go = useCallback((d: string | null, to: 1 | -1) => {
    if (!d) return;
    haptic("select");
    // Закрываться теперь нужно в плитку этого дня, а не в ту, из которой открывали.
    origin.current = document.querySelector<HTMLElement>(`a.tile[href="/day/${d}"]`) ?? origin.current;
    setDir(to);
    setInvite(false);
    setDay(d);
    panel.current?.scrollTo({ top: 0 });
  }, []);

  // В Telegram у дня — системная кнопка «Назад» в шапке приложения.
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

  // Ссылка из напоминания (/?day=2026-10-10) сразу открывает этот день.
  useEffect(() => {
    const url = new URL(window.location.href);
    const wanted = url.searchParams.get("day");
    if (!wanted || !/^\d{4}-\d{2}-\d{2}$/.test(wanted)) return;
    url.searchParams.delete("day");
    history.replaceState(history.state, "", url.pathname + url.search);
    const timer = setTimeout(() => open(wanted, null));
    return () => clearTimeout(timer);
  }, [open]);

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
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-day])')) return; // открыта шторка
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
