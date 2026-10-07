import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { getViewer } from "@/lib/crew";

// Сюда попадают без приглашения или для повторного входа с нового устройства.
export default async function WelcomePage() {
  const viewer = await getViewer();
  if (viewer.isMember) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-10 px-6 py-10">
      <div>
        <h1 className="text-[clamp(52px,14vw,72px)] leading-[0.9] font-extrabold tracking-[-0.05em]">brbs mafia</h1>
        <p className="mt-3 text-[15px] text-dim">
          {viewer.user ? "Твоего аккаунта нет в компании. Сюда попадают только по приглашению." : "Сюда попадают только по приглашению. Уже в компании? Войди."}
        </p>
      </div>
      {!viewer.user && <SignInButton />}
    </main>
  );
}
