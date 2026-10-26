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
 * Verifies the data Telegram passes to the Mini App (initData):
 * the signature is derived from the bot token and can't be forged without it.
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
 * Whether a person is in our group (TELEGRAM_GROUP_ID). The bot must be in the group.
 * "unknown" means no answer or an answer that isn't about the person (network, rate limits, bot not configured):
 * nobody may be removed based on such a result.
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

/** A private message from the bot. Silently fails if the person hasn't allowed the bot to write. */
/** Button under a message: open the Mini App or answer the bot (callback). */
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

/** Changes the buttons of an already sent message (to mark the pressed one). */
export async function editKeyboard(chatId: number, messageId: number, keyboard: Keyboard) {
  return call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: markup(keyboard) });
}

/** Pop-up answer to a button press. */
export async function answerCallback(id: string, text: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

/**
 * The secret Telegram sends in a header with every webhook request.
 * Derived from the bot token so we don't need yet another variable.
 */
export function webhookSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? createHmac("sha256", "brbs-webhook").update(token).digest("hex").slice(0, 48) : null;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
