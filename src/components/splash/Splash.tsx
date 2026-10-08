"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { Member } from "@/lib/types";
import { choreography, entranceLength, type Frame } from "./choreography";

// Живёт, пока открыта вкладка: при перезагрузке страницы модуль загружается заново
// и экран показывается снова, а при переходах внутри сайта — нет.
let playedThisLoad = false;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const START = 260; // пауза перед выходом участников
const HOLD = 520; // все собрались — короткая пауза
const OUT = 540; // финал: собираются в букву и экран растворяется
const AVATAR = 64;

const keyframe = (f: Frame): Keyframe => ({
  transform: `translate(${f.x}px, ${f.y}px) scale(${f.s ?? 1})`,
  opacity: f.o ?? 1,
  ...(f.offset !== undefined ? { offset: f.offset } : {}),
});

/**
 * Экран загрузки «сбор пати»: аватарки участников слетаются к букве B —
 * по своей постановке для каждого числа людей (1–8). Показывается при каждом
 * открытии сайта и перезагрузке страницы, но не при переходах внутри сайта.
 */
export function Splash({ members, demo = false, freezeAt }: { members: Member[]; demo?: boolean; freezeAt?: number }) {
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(0); // в демо — повтор по кругу
  const root = useRef<HTMLDivElement>(null);
  const crew = members.slice(0, 8);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const finish = () => {
      if (demo) return setRound((r) => r + 1);
      playedThisLoad = true;
      // Для заглушки загрузки (app/loading.tsx): дальше в этой вкладке — обычный скелет, без буквы.
      document.documentElement.dataset.splashSeen = "1";
      setDone(true);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!demo && (playedThisLoad || !crew.length)) {
      el.style.display = "none";
      const t = setTimeout(finish);
      return () => clearTimeout(t);
    }

    const moves = choreography(crew.length);
    const avatars = [...el.querySelectorAll<HTMLElement>("[data-member]")];
    const letter = el.querySelector<HTMLElement>("[data-letter]")!;
    const animations: Animation[] = [];

    // «Уменьшить движение» в системе: компания сразу стоит на местах, экран просто гаснет.
    if (reduce) {
      avatars.forEach((a, i) => {
        const last = moves[i]?.frames.at(-1);
        if (last) Object.assign(a.style, { transform: keyframe({ ...last, o: 1 }).transform as string, opacity: "1" });
      });
      const fade = setTimeout(() => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }), 1100);
      const end = setTimeout(finish, 1450);
      return () => {
        clearTimeout(fade);
        clearTimeout(end);
      };
    }

    avatars.forEach((a, i) => {
      const m = moves[i];
      if (!m) return;
      animations.push(a.animate(m.frames.map(keyframe), { duration: m.duration, delay: START + m.delay, easing: EASE, fill: "both" }));
    });

    const gathered = START + entranceLength(moves);
    // Все на месте — буква отвечает коротким толчком.
    animations.push(
      letter.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], {
        duration: 460,
        delay: gathered - 80,
        easing: EASE,
      }),
    );

    // Предпросмотр: стоп-кадр на заданной миллисекунде, без финала.
    if (freezeAt !== undefined) {
      animations.forEach((a) => {
        a.pause();
        a.currentTime = freezeAt;
      });
      return () => animations.forEach((a) => a.cancel());
    }

    const outAt = gathered + HOLD;
    const timers = [
      setTimeout(() => {
        avatars.forEach((a, i) => {
          const last = moves[i]?.frames.at(-1);
          if (!last) return;
          a.animate([keyframe({ ...last, o: 1 }), { transform: "translate(0px, 0px) scale(0.3)", opacity: 0 }], {
            duration: OUT,
            easing: "cubic-bezier(0.5, 0, 0.75, 0)",
            fill: "forwards",
          });
        });
        letter.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }], {
          duration: OUT,
          delay: OUT * 0.5,
          easing: EASE,
          fill: "forwards",
        });
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OUT, delay: OUT * 0.7, fill: "forwards" });
      }, outAt),
      setTimeout(finish, outAt + OUT * 1.7),
    ];

    return () => {
      timers.forEach(clearTimeout);
      animations.forEach((a) => a.cancel());
    };
    // Постановка выбирается один раз при открытии (в демо — на каждый круг).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  if (done) return null;
  return (
    <div
      key={round}
      ref={root}
      className={`${demo ? "" : "splash"} fixed inset-0 z-[60] flex items-center justify-center bg-ink`}
      aria-hidden="true"
    >
      {/* На узком экране сцена чуть ужимается, чтобы корона и орбита не вылезали за края. */}
      <div className="relative size-0 max-[480px]:scale-[0.8]">
        {crew.map((m) => (
          <div key={m.id} data-member className="absolute opacity-0" style={{ top: -AVATAR / 2, left: -AVATAR / 2 }}>
            <Avatar id={m.id} name={m.name} url={m.avatar_url} size={AVATAR} ring="var(--color-ink)" />
          </div>
        ))}
        <SplashLetter />
      </div>
    </div>
  );
}

/** Буква B в круге — общая для экрана загрузки и заглушки, пока грузятся данные. */
export function SplashLetter() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-letter
      src="/brand/b.png"
      alt=""
      width={92}
      height={92}
      className="absolute -top-[46px] -left-[46px] size-[92px] max-w-none rounded-full"
    />
  );
}
