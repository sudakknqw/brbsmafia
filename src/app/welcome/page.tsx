import { redirect } from "next/navigation";
import { TelegramGate } from "@/components/telegram/TelegramGate";
import { Wordmark } from "@/components/Wordmark";
import { getViewer } from "@/lib/crew";

// Login: automatic inside Telegram; in a browser, an "Open in Telegram" button.
export default async function WelcomePage() {
  const viewer = await getViewer();
  if (viewer.isMember) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-12 px-6 py-10 text-center">
      <h1 className="anim-rise">
        <Wordmark className="h-auto w-[min(82vw,620px)]" />
        <span className="sr-only">brbs mafia</span>
      </h1>
      <div className="anim-rise w-full max-w-sm" style={{ animationDelay: "0.1s" }}>
        <TelegramGate appUrl={process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ?? null} />
      </div>
    </main>
  );
}
