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

/** Состоит ли человек в нашей группе (TELEGRAM_GROUP_ID). Бот должен быть в группе. */
export async function isGroupMember(userId: number): Promise<boolean> {
  const chatId = process.env.TELEGRAM_GROUP_ID;
  if (!chatId) return false;
  const res = await fetch(`${API()}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${userId}`, { cache: "no-store" });
  if (!res.ok) return false;
  const { result } = (await res.json()) as { result?: { status: string; is_member?: boolean } };
  if (!result) return false;
  return ["creator", "administrator", "member"].includes(result.status) || (result.status === "restricted" && !!result.is_member);
}

/** Личное сообщение от бота. Молча не получается, если человек не разрешил боту писать. */
export async function sendMessage(chatId: number, text: string, button?: { text: string; url: string }) {
  const res = await fetch(`${API()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: button ? { inline_keyboard: [[{ text: button.text, web_app: { url: button.url } }]] } : undefined,
    }),
  });
  return res.ok;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
