-- Короткая заметка к своему дню: «после 23 без микрофона», «могу опоздать на полчаса».
-- Видна всем на шкале дня. Права уже есть: свою строку дня можно править (own days update).
alter table public.day_entries
  add column if not exists note text
  constraint day_entries_note_length check (char_length(note) <= 80);
