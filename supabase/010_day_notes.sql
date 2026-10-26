-- A short note for your day: "no mic after 11pm", "might be half an hour late".
-- Visible to everyone on the day timeline. Permissions already exist: you can edit your own day row (own days update).
alter table public.day_entries
  add column if not exists note text
  constraint day_entries_note_length check (char_length(note) <= 80);
