import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { Wordmark } from "@/components/Wordmark";
import { getViewer } from "@/lib/crew";

// Вход: участники нашего Discord-сервера проходят сразу, остальные — по приглашению.
export default async function WelcomePage() {
  const viewer = await getViewer();
  if (viewer.isMember) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-12 px-6 py-10 text-center">
      <h1 className="anim-rise">
        <Wordmark className="h-auto w-[min(82vw,620px)]" />
        <span className="sr-only">brbs mafia</span>
      </h1>
      <div className="anim-rise w-full max-w-sm space-y-4" style={{ animationDelay: "0.1s" }}>
        {viewer.user && (
          <p className="text-[15px] text-dim">Тебя нет на нашем Discord-сервере. Зайди на него и войди снова или попроси у друзей ссылку-приглашение.</p>
        )}
        <SignInButton />
      </div>
    </main>
  );
}
