import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
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
  const { count } = await admin.from("members").select("*", { count: "exact", head: true });
  const inviter = (invite?.profiles as unknown as { name: string } | null)?.name;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-between px-6 py-10">
      <p className="text-sm text-dim">Приглашение</p>

      <div>
        <h1 className="text-[40px] font-bold leading-none tracking-tight">brbs mafia</h1>
        <p className="mt-3 text-[15px] text-dim">
          {valid ? `Общее расписание и игры${count ? ` для ${count + 1} человек` : ""}` : "Ссылка устарела или неверная. Попроси новую у друзей."}
        </p>
      </div>

      <div className="space-y-3">
        {valid && <SignInButton next={`/join/${code}`} />}
        {inviter && valid && <p className="text-center text-sm text-dim">Пригласил {inviter}</p>}
      </div>
    </main>
  );
}
