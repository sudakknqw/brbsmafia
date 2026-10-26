-- Personal library order: game ids in order. Games not in the list go last.
alter table public.profiles add column if not exists library_order bigint[] not null default '{}';
