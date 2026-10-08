"use client";

import { useEffect, useState } from "react";
import { gameArt, plateColor } from "@/lib/steam";
import type { Game } from "@/lib/types";

/**
 * Перебирает картинки по очереди, пока какая-нибудь не загрузится.
 * Новый список (например, загрузили свою обложку) — начинаем сначала.
 */
function useFallback(sources: string[]) {
  const key = sources.join("|");
  const [state, setState] = useState({ key, index: 0 });
  const index = state.key === key ? state.index : 0;
  return {
    src: sources[index] as string | undefined,
    index,
    failed: () => setState({ key, index: index + 1 }),
  };
}

/** Вертикальная обложка, как в библиотеке Steam. */
export function Cover({ game, className = "" }: { game: Game; className?: string }) {
  const art = gameArt(game);
  const { src, failed, index } = useFallback([...art.portrait, ...art.portraitFallback]);

  if (!src) {
    return (
      <div
        style={{ background: plateColor(game.name) }}
        className={`flex aspect-[2/3] items-end overflow-hidden rounded-[10px] p-2.5 text-[13px] leading-tight font-semibold text-white ${className}`}
      >
        {game.name}
      </div>
    );
  }
  const header = index >= art.portrait.length;
  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-[10px] bg-glass ${className}`}>
      {header && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={game.name}
        loading="lazy"
        onError={failed}
        className={header ? "absolute inset-x-0 top-1/2 w-full -translate-y-1/2" : "h-full w-full object-cover"}
      />
    </div>
  );
}

/** Широкий арт на фон. */
export function HeroArt({ game, className = "" }: { game: Game; className?: string }) {
  const art = gameArt(game);
  const { src, failed, index } = useFallback([...art.hero, ...art.heroFallback]);

  if (!src) return <div style={{ background: plateColor(game.name) }} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden
      onError={failed}
      className={`object-cover ${index >= art.hero.length ? "scale-110 blur-md" : ""} ${className}`}
    />
  );
}

/** Логотип игры; если его нет — название крупным шрифтом. */
export function Logo({ game, className = "" }: { game: Game; className?: string }) {
  const { src, failed } = useFallback(gameArt(game).logo);

  if (!src) {
    return <p className={`text-[clamp(34px,7vw,64px)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance ${className}`}>{game.name}</p>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={game.name} onError={failed} className={`object-contain object-left drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${className}`} />
  );
}

/**
 * Подкрашивает весь сайт под игру: берёт средний насыщенный цвет из арта.
 * Steam отдаёт картинки с CORS, поэтому их можно прочитать в canvas.
 */
export function Ambient({ game }: { game: Game | null }) {
  const art = game ? gameArt(game) : null;
  const sample = art ? [...art.header, ...art.hero][0] : undefined;
  const fallback = game ? plateColor(game.name) : null;

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--ambient");
    let alive = true;
    const set = (rgb: string) => alive && root.style.setProperty("--ambient", rgb);
    // Когда экран закрывается (например, панель дня), возвращаем прежний цвет.
    const restore = () => {
      alive = false;
      if (previous) root.style.setProperty("--ambient", previous);
    };
    if (!sample) {
      if (fallback) set(hexToRgb(fallback));
      return restore;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = sample;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 46;
        canvas.height = 22;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 46, 22);
        const px = ctx.getImageData(0, 0, 46, 22).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < px.length; i += 4) {
          const max = Math.max(px[i], px[i + 1], px[i + 2]);
          const min = Math.min(px[i], px[i + 1], px[i + 2]);
          const weight = (max - min) / 255 + 0.05; // насыщенные пиксели важнее серых
          r += px[i] * weight;
          g += px[i + 1] * weight;
          b += px[i + 2] * weight;
          w += weight;
        }
        // Приглушаем, чтобы фон оставался тёмным, а текст — читаемым.
        const k = 140 / Math.max(r / w, g / w, b / w, 1);
        set(`${Math.round((r / w) * Math.min(k, 1))} ${Math.round((g / w) * Math.min(k, 1))} ${Math.round((b / w) * Math.min(k, 1))}`);
      } catch {
        /* картинку не дали прочитать — остаётся прежний цвет */
      }
    };
    return restore;
  }, [sample, fallback]);

  return null;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
