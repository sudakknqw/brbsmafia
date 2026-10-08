// Подписи и шутки сайта. Каждая берётся «случайно, но стабильно»:
// для одного и того же человека и дня — одна и та же фраза, без мигания.
// Список выбран в документе «brbs mafia — фразы на выбор».

/** Кто ничего не отметил на день. */
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

/** Кто нажал NO: предупредил честно, поэтому помягче. */
export const BUSY = ["сегодня пас", "не в этот раз", "честно слился, уважаем", "на скамейке запасных", "не сегодня, друзья", "сохранился и вышел"];

/** Общего окна нет. */
export const NO_MATCH = ["Пока никто не совпал", "Часовые пояса победили. Пока", "Никого. Совсем никого"];

/** Кнопки сбора. */
export const JOIN = ["Я в деле", "Иду"];
export const DECLINE = ["Пас", "Без меня", "Сегодня мимо"];

export function pick<T>(list: readonly T[], seed: string | number): T {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export const silentPhrase = (userId: string, day: string) => pick(SILENT, userId + day);
export const busyPhrase = (userId: string, day: string) => pick(BUSY, userId + day);
export const noMatchPhrase = (day: string) => pick(NO_MATCH, day);
