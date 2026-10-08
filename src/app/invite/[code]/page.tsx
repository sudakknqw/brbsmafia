import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { Wordmark } from "@/components/Wordmark";
import { getViewer } from "@/lib/crew";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const viewer = await getViewer();
  if (viewer.isMember) redirect("/");

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("expires_at, profiles!invites_created_by_fkey(name)")
    .eq("code", code)
    .maybeSingle();
  const valid = invite && new Date(invite.expires_at) > new Date();
  const inviter = (invite?.profiles as unknown as { name: string } | null)?.name;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-12 px-6 py-10 text-center">
      <h1 className="anim-rise">
        <Wordmark className="h-auto w-[min(82vw,620px)]" />
        <span className="sr-only">brbs mafia</span>
      </h1>
      <div className="anim-rise w-full max-w-sm space-y-4" style={{ animationDelay: "0.1s" }}>
        {valid ? (
          <>
            {inviter && <p className="text-[15px] text-dim">Зовёт {inviter}</p>}
            <SignInButton next={`/join/${code}`} />
          </>
        ) : (
          <p className="text-[15px] text-dim">Ссылка устарела или неверная. Попроси новую у друзей.</p>
        )}
      </div>
    </main>
  );
}
