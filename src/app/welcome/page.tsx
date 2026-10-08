import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { Wordmark } from "@/components/Wordmark";
import { getViewer } from "@/lib/crew";

// Вход: участники нашего Discord-сервера проходят сразу, остальные — по приглашению.
const WHY: Record<string, string> = {
  "not-in-guild": "Тебя нет на нашем Discord-сервере. Зайди на него и войди снова или попроси у друзей ссылку-приглашение.",
  "no-guild-id": "Вход по Discord-серверу ещё не настроен. Попроси у друзей ссылку-приглашение.",
  "no-token": "Discord не передал список твоих серверов. Попробуй войти ещё раз.",
  "discord-error": "Discord не ответил. Попробуй войти ещё раз через минуту.",
};

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const viewer = await getViewer();
  if (viewer.isMember) redirect("/");
  const why = (await searchParams).why;
  const reason = typeof why === "string" ? WHY[why] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-12 px-6 py-10 text-center">
      <h1 className="anim-rise">
        <Wordmark className="h-auto w-[min(82vw,620px)]" />
        <span className="sr-only">brbs mafia</span>
      </h1>
      <div className="anim-rise w-full max-w-sm space-y-4" style={{ animationDelay: "0.1s" }}>
        {viewer.user && <p className="text-[15px] text-dim">{reason ?? WHY["not-in-guild"]}</p>}
        <SignInButton />
      </div>
    </main>
  );
}
