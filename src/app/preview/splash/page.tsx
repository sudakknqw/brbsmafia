import Link from "next/link";
import { notFound } from "next/navigation";
import { Splash } from "@/components/splash/Splash";
import { mockCrew } from "../mock";

// Экран загрузки по кругу: /preview/splash?n=1 … n=8, стоп-кадр — &t=900.
// В продакшене страницы нет.
export default async function SplashPreview({ searchParams }: PageProps<"/preview/splash">) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const n = Math.min(8, Math.max(1, Number(params.n) || 8));
  const t = params.t !== undefined ? Number(params.t) : undefined; // стоп-кадр, мс
  const members = mockCrew().members.slice(0, n);
  return (
    <>
      <Splash key={`${n}-${t}`} members={members} demo freezeAt={t} />
      <nav className="fixed inset-x-0 bottom-6 z-[70] flex justify-center gap-2">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((k) => (
          <Link
            key={k}
            href={`/preview/splash?n=${k}`}
            className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${k === n ? "bg-fg text-ink" : "bg-glass text-dim"}`}
          >
            {k}
          </Link>
        ))}
      </nav>
    </>
  );
}
