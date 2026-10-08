-- brbs mafia: сборы пати (фишка «Сбор в один клик») и данные для итогов месяца.
-- Запускать один раз в Supabase → SQL Editor → New query → Run.

-- Один сбор на игровой день.
create table public.gatherings (
  id bigint generated always as identity primary key,
  day date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  game_id bigint references public.games on delete set null,
  game_name text not null, -- название на случай, если игру уберут из библиотеки
  created_by uuid references public.profiles on delete set null,
  discord_message_id text,
  created_at timestamptz not null default now()
);

-- Кто в деле, а кто не пойдёт.
create table public.gathering_members (
  gathering_id bigint references public.gatherings on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  status text not null check (status in ('in', 'out')),
  updated_at timestamptz not null default now(),
  primary key (gathering_id, user_id)
);

alter table public.gatherings enable row level security;
alter table public.gathering_members enable row level security;

create policy "members read gatherings" on public.gatherings
  for select using (public.is_member());
create policy "members start gatherings" on public.gatherings
  for insert with check (public.is_member() and created_by = auth.uid());
create policy "creator cancels gathering" on public.gatherings
  for delete using (created_by = auth.uid());

create policy "members read gathering members" on public.gathering_members
  for select using (public.is_member());
create policy "own gathering status insert" on public.gathering_members
  for insert with check (public.is_member() and user_id = auth.uid());
create policy "own gathering status update" on public.gathering_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own gathering status delete" on public.gathering_members
  for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.gatherings, public.gathering_members;
