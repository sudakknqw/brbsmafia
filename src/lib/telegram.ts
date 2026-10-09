import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  allows_write_to_pm?: boolean;
};

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Проверяет данные, которые Telegram передаёт мини-приложению (initData):
 * подпись считается от токена бота, подделать её без токена нельзя.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData: string, maxAgeSeconds = 24 * 3600): TelegramUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const checkString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest("hex");
  if (expected.length !== hash.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    return JSON.parse(params.get("user") ?? "null") as TelegramUser | null;
  } catch {
    return null;
  }
}

/**
 * Состоит ли человек в нашей группе (TELEGRAM_GROUP_ID). Бот должен быть в группе.
 * «unknown» — ответа нет или он не про человека (сеть, лимиты, бот не настроен):
 * по такому результату никого нельзя выгонять.
 */
export async function groupMemberStatus(userId: number): Promise<"member" | "gone" | "unknown"> {
  const chatId = process.env.TELEGRAM_GROUP_ID;
  if (!chatId) return "unknown";
  try {
    const res = await fetch(`${API()}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`, { cache: "no-store" });
    if (!res.ok) return "unknown";
    const { ok, result } = (await res.json()) as { ok?: boolean; result?: { status: string; is_member?: boolean } };
    if (!ok || !result) return "unknown";
    if (["creator", "administrator", "member"].includes(result.status)) return "member";
    if (result.status === "restricted") return result.is_member ? "member" : "gone";
    if (result.status === "left" || result.status === "kicked") return "gone";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function isGroupMember(userId: number): Promise<boolean> {
  return (await groupMemberStatus(userId)) === "member";
}

/** Личное сообщение от бота. Молча не получается, если человек не разрешил боту писать. */
/** Кнопка под сообщением: открыть мини-приложение или ответить боту (callback). */
export type Button = { text: string; url: string } | { text: string; data: string };
export type Keyboard = Button[][];

const markup = (keyboard?: Keyboard) =>
  keyboard
    ? {
        inline_keyboard: keyboard.map((row) =>
          row.map((b) => ("url" in b ? { text: b.text, web_app: { url: b.url } } : { text: b.text, callback_data: b.data })),
        ),
      }
    : undefined;

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return !!res?.ok;
}

export async function sendMessage(chatId: number, text: string, keyboard?: Keyboard) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: markup(keyboard),
  });
}

/** Поменять кнопки у уже отправленного сообщения (отметить выбранную). */
export async function editKeyboard(chatId: number, messageId: number, keyboard: Keyboard) {
  return call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: markup(keyboard) });
}

/** Всплывающий ответ на нажатие кнопки. */
export async function answerCallback(id: string, text: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

/**
 * Секрет, который Telegram присылает в заголовке каждого запроса на вебхук.
 * Выводится из токена бота, чтобы не заводить ещё одну переменную.
 */
export function webhookSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? createHmac("sha256", "brbs-webhook").update(token).digest("hex").slice(0, 48) : null;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
