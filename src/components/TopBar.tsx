import Link from "next/link";
import { Avatar } from "./Avatar";
import { Wordmark } from "./Wordmark";
import type { Member } from "@/lib/types";

export function TopBar({ me, back }: { me: Member; back?: boolean }) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-8 sm:pt-6">
      {back ? (
        <Link
          href="/"
          className="-ml-2 flex items-center gap-1.5 rounded-full py-1.5 pr-3 pl-2 text-[15px] font-medium transition hover:bg-glass"
        >
          <svg width="9" height="15" viewBox="0 0 10 17" aria-hidden="true">
            <path d="M8.5 1.5L2 8.5l6.5 7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Главная
        </Link>
      ) : (
        <Link href="/" aria-label="brbs mafia, на главную" className="transition hover:opacity-80">
          <Wordmark className="h-[18px] w-auto sm:h-[21px]" />
        </Link>
      )}
      <div className="flex items-center gap-2.5">
        <Link href="/profile" aria-label="Профиль" className="rounded-full transition hover:scale-105">
          <Avatar id={me.id} name={me.name} url={me.avatar_url} size={34} />
        </Link>
      </div>
    </header>
  );
}
