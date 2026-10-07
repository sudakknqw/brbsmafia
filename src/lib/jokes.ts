// Подписи для тех, кто ничего не отметил на день.
// Дописывай сюда свои — выбирается случайная, но стабильная на день.
export const SILENT_JOKES = [
  "молчит, гадёныш",
  "ушёл в туман",
  "читает и не отвечает",
];

export function silentJoke(userId: string, day: string): string {
  let h = 0;
  for (const ch of userId + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SILENT_JOKES[h % SILENT_JOKES.length];
}
