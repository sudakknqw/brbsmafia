// Site captions and jokes. Each one is picked "randomly but stably":
// the same person and day always get the same phrase, no flicker.
// The list was picked by the crew from a longer shortlist.

/** Someone who marked nothing for the day. */
export const SILENT = [
  "молчит, гадёныш",
  "ушёл в туман",
  "читает и не отвечает",
  "AFK с понедельника",
  "пинг 999",
  "вышел из чата",
  "лагает по жизни",
  "соло ранкед",
  "не в ресурсе",
  "телепортирован в реал",
  "трогает траву",
  "перекур затянулся",
  "ждёт приглашения особым письмом",
  "ужинает второй час",
  "мама забрала комп",
];

/** Someone who pressed NO: they were upfront, so go easier on them. */
export const BUSY = ["сегодня пас", "не в этот раз", "честно слился, уважаем", "на скамейке запасных", "не сегодня, друзья", "сохранился и вышел"];

/** No common window. */
export const NO_MATCH = ["Пока никто не совпал", "Часовые пояса победили. Пока", "Никого. Совсем никого"];

/** Session buttons. */
export const JOIN = ["Я в деле", "Иду"];
export const DECLINE = ["Пас", "Без меня", "Сегодня мимо"];

export function pick<T>(list: readonly T[], seed: string | number): T {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

/**
 * Personal captions: these people always get their own phrase instead of a random one,
 * when silent, on NO and with no status. Keyed by id, not name: names can change.
 */
const PERSONAL: Record<string, string> = {
  "41e352ad-bb2e-4b7e-b528-e7caa3d7657c": "ему похуй", // никита
};
export const personalPhrase = (userId: string): string | null => PERSONAL[userId] ?? null;

export const silentPhrase = (userId: string, day: string) => personalPhrase(userId) ?? pick(SILENT, userId + day);
export const busyPhrase = (userId: string, day: string) => personalPhrase(userId) ?? pick(BUSY, userId + day);
export const noMatchPhrase = (day: string) => pick(NO_MATCH, day);
