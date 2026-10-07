"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncTimezone, updateProfile } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "./Avatar";

type Props = {
  id: string;
  name: string;
  avatarUrl: string | null;
  submitLabel: string;
  redirectTo?: string;
};

export function ProfileForm({ id, name: initialName, avatarUrl, submitLabel, redirectTo }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    syncTimezone(tz);
    const tick = () => setNow(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 3_000_000) {
      setError("Нужна картинка до 3 МБ");
      return;
    }
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${id}/${Date.now()}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (upErr) {
      setError("Не получилось загрузить. Попробуй ещё раз.");
      return;
    }
    setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
  };

  const submit = () =>
    start(async () => {
      const res = await updateProfile({ name, avatarUrl: avatar });
      if (res.error) setError(res.error);
      else if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => fileInput.current?.click()} className="relative shrink-0 transition hover:scale-105" aria-label="Сменить аватарку">
          <Avatar id={id} name={name || "?"} url={avatar} size={72} />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full bg-fg text-ink ring-[3px] ring-ink">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={32}
            placeholder="Ник"
            className="w-full rounded-full bg-glass px-5 py-3.5 text-[17px] outline-none focus:bg-glass2"
          />
          <p className="mt-2 px-1 text-sm text-dim">{uploading ? "Загружаем аватарку…" : now ? `Местное время ${now}` : " "}</p>
        </div>
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}

      <button
        onClick={submit}
        disabled={pending || uploading}
        className="w-full rounded-full bg-fg py-3.5 text-[16px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Сохраняем…" : submitLabel}
      </button>
    </div>
  );
}
