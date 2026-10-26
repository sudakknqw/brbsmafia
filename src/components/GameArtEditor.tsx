"use client";

import { useRef, useState, useTransition } from "react";
import { setGameArt } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { ART_SPECS, artPath, fitImage, MAX_UPLOAD, type ArtKind } from "@/lib/imageFit";
import { gameArt } from "@/lib/steam";
import type { Game } from "@/lib/types";
import { Cover, HeroArt, Logo } from "./GameArt";
import { HeaderCard } from "./day/HeaderCard";

const FIELD: Record<ArtKind, "cover_url" | "hero_url" | "header_url" | "logo_url"> = {
  cover: "cover_url",
  hero: "hero_url",
  header: "header_url",
  logo: "logo_url",
};

/**
 * Custom game art: cover, hero, header, logo. The file is fitted to
 * Steam's sizes in the browser, uploaded to storage and immediately visible to everyone.
 */
export function GameArtEditor({ game, onRemove }: { game: Game; onRemove?: () => void }) {
  // Local URLs over the server ones: the preview updates right away, without waiting for a refresh.
  const [local, setLocal] = useState<Partial<Record<ArtKind, string | null>>>({});
  const [busy, setBusy] = useState<ArtKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const shown: Game = {
    ...game,
    cover_url: local.cover !== undefined ? local.cover : game.cover_url,
    hero_url: local.hero !== undefined ? local.hero : game.hero_url,
    header_url: local.header !== undefined ? local.header : game.header_url,
    logo_url: local.logo !== undefined ? local.logo : game.logo_url,
  };

  const upload = async (kind: ArtKind, file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Нужна картинка: JPG, PNG или WebP.");
    if (file.size > MAX_UPLOAD) return setError("Картинка больше 15 МБ. Возьми поменьше.");
    setBusy(kind);
    try {
      const { blob, ext } = await fitImage(file, kind);
      const supabase = createClient();
      const path = artPath(game.id, kind, ext);
      const { error: upErr } = await supabase.storage.from("games").upload(path, blob, { contentType: blob.type });
      if (upErr) throw upErr;
      const url = supabase.storage.from("games").getPublicUrl(path).data.publicUrl;
      setLocal((l) => ({ ...l, [kind]: url }));
      start(() => setGameArt(game.id, FIELD[kind], url));
    } catch {
      setError("Не получилось загрузить. Проверь, что миграция 003_game_art.sql запущена, и попробуй ещё раз.");
    } finally {
      setBusy(null);
    }
  };

  const reset = (kind: ArtKind) => {
    setLocal((l) => ({ ...l, [kind]: null }));
    start(() => setGameArt(game.id, FIELD[kind], null));
  };

  return (
    <div>
      <p className="mb-5 text-[15px] text-dim">
        {game.steam_appid ? "Свои картинки заменят картинки из Steam." : "Игры нет в Steam — загрузи картинки сам."} Картинка сама
        обрежется под нужный размер.
      </p>

      <div className="space-y-5">
        {(Object.keys(ART_SPECS) as ArtKind[]).map((kind) => (
          <Slot
            key={kind}
            kind={kind}
            game={shown}
            custom={!!shown[FIELD[kind]]}
            busy={busy === kind}
            onFile={(f) => upload(kind, f)}
            onReset={() => reset(kind)}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-[13px] text-bad">{error}</p>}

      {onRemove && (
        <button onClick={onRemove} className="mt-7 w-full rounded-full bg-glass py-3 text-[15px] text-bad transition hover:bg-glass2">
          Убрать игру из библиотеки
        </button>
      )}
    </div>
  );
}

function Slot({
  kind,
  game,
  custom,
  busy,
  onFile,
  onReset,
}: {
  kind: ArtKind;
  game: Game;
  custom: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  onReset: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const spec = ART_SPECS[kind];
  const hasAny = kind === "logo" ? gameArt(game).logo.length > 0 : true;

  return (
    <div className="flex items-center gap-4">
      <div className={`shrink-0 overflow-hidden rounded-[10px] bg-glass ${kind === "cover" ? "w-[60px]" : "w-[132px]"} ${busy ? "animate-pulse" : ""}`}>
        {kind === "cover" && <Cover key={game.cover_url ?? "steam"} game={game} />}
        {kind === "header" && <HeaderCard game={game} />}
        {kind === "hero" && (
          <div className="relative aspect-[1920/620]">
            <HeroArt key={game.hero_url ?? "steam"} game={game} className="absolute inset-0 h-full w-full" />
          </div>
        )}
        {kind === "logo" && (
          <div className="flex aspect-[16/9] items-center justify-center bg-[#2a2a30] p-2">
            {hasAny ? <Logo game={game} className="max-h-full max-w-full" /> : <span className="text-[11px] text-faint">нет</span>}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{spec.label}</p>
        <p className="text-[13px] text-dim">{busy ? "Загружаем…" : custom ? "своя картинка" : spec.hint}</p>
        <div className="mt-2 flex gap-2">
          <button
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-full bg-glass2 px-3.5 py-1.5 text-[13px] font-medium transition hover:bg-white/20 disabled:opacity-50"
          >
            {custom ? "Заменить" : "Загрузить"}
          </button>
          {custom && (
            <button onClick={onReset} className="rounded-full px-3 py-1.5 text-[13px] text-dim transition hover:text-fg">
              Убрать свою
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>
    </div>
  );
}
