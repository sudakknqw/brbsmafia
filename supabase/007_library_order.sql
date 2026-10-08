-- Свой порядок игр в библиотеке: id игр по порядку. Игр не из списка — в конце.
alter table public.profiles add column if not exists library_order bigint[] not null default '{}';
