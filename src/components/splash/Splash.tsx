"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { Member } from "@/lib/types";
import { choreography, entranceLength, type Frame } from "./choreography";

// Lives as long as the tab: a page reload loads the module again
// and the screen shows again, but in-app navigation doesn't.
let playedThisLoad = false;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const START = 260; // pause before the members enter
const HOLD = 520; // everyone is in: short pause
const OUT = 540; // finale: they merge into the letter and the screen dissolves
const AVATAR = 64;

const keyframe = (f: Frame): Keyframe => ({
  transform: `translate(${f.x}px, ${f.y}px) scale(${f.s ?? 1})`,
  opacity: f.o ?? 1,
  ...(f.offset !== undefined ? { offset: f.offset } : {}),
});

/**
 * "Party gathering" splash screen: member avatars fly in towards the letter B,
 * with a choreography for each crew size (1–8). Shown on every
 * site open and page reload, but not on in-app navigation.
 */
export function Splash({ members, demo = false, freezeAt }: { members: Member[]; demo?: boolean; freezeAt?: number }) {
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(0); // in demo mode: loop
  const root = useRef<HTMLDivElement>(null);
  const crew = members.slice(0, 8);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const finish = () => {
      if (demo) return setRound((r) => r + 1);
      playedThisLoad = true;
      // For the loading placeholder (app/loading.tsx): later in this tab, the regular skeleton without the letter.
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

    // "Reduce motion" in the OS: the crew is already in place and the screen just fades.
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
    // Everyone is in place: the letter answers with a short bump.
    animations.push(
      letter.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], {
        duration: 460,
        delay: gathered - 80,
        easing: EASE,
      }),
    );

    // Preview: freeze frame at the given millisecond, no finale.
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
    // The choreography is chosen once on open (in demo mode, on every loop).
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
      {/* On narrow screens the stage shrinks a little so the crown and orbit stay inside. */}
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

/** The B-in-a-circle mark, shared by the splash screen and the loading placeholder. */
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
