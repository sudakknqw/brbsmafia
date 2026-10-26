"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSteamProfile } from "@/app/actions";

/** Field for the Steam profile link. onSaved runs after a successful save. */
export function SteamLinkForm({ initial = "", onSaved }: { initial?: string; onSaved?: () => void }) {
  const router = useRouter();
  const [link, setLink] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await setSteamProfile(link);
      setError(res.error);
      setWarning(res.warning ?? null);
      if (res.error) return;
      setSaved(true);
      router.refresh();
      if (!res.warning) onSaved?.();
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (link.trim()) save();
      }}
      className="space-y-3"
    >
      <input
        value={link}
        onChange={(e) => {
          setLink(e.target.value);
          setError(null);
          setSaved(false);
        }}
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="steamcommunity.com/id/…"
        className="w-full rounded-full bg-glass px-5 py-3.5 text-[16px] outline-none focus:bg-glass2"
      />
      {error && <p className="px-1 text-sm text-bad">{error}</p>}
      {warning && <p className="px-1 text-sm text-dim">{warning}</p>}
      <button
        type="submit"
        disabled={pending || !link.trim()}
        className="w-full rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Проверяем…" : saved ? "Сохранено" : "Сохранить"}
      </button>
    </form>
  );
}
