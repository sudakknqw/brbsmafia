import Link from "next/link";
import { Avatar } from "./Avatar";
import { InviteButton } from "./InviteButton";
import type { Member } from "@/lib/types";

export function Header({ me, back }: { me: Member; back?: boolean }) {
  return (
    <header className="flex items-center justify-between py-5">
      {back ? (
        <Link href="/" className="-ml-1 flex items-center gap-1 text-[17px] text-accent">
          <svg width="10" height="17" viewBox="0 0 10 17" aria-hidden="true">
            <path d="M8.5 1.5L2 8.5l6.5 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Назад
        </Link>
      ) : (
        <Link href="/" className="text-[22px] font-bold tracking-tight">
          brbs mafia
        </Link>
      )}
      <div className="flex items-center gap-3">
        <InviteButton />
        <Link href="/profile" aria-label="Профиль">
          <Avatar id={me.id} name={me.name} url={me.avatar_url} size={32} />
        </Link>
      </div>
    </header>
  );
}
