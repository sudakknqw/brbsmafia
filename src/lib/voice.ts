// Кто сейчас сидит в голосовых каналах Discord — общий формат для сервера и страницы.

export type VoicePerson = { username: string; avatar_url: string | null };
export type VoiceChannel = { id: string; name: string; people: VoicePerson[] };

/** available: false — виджет выключен, сервер не настроен или Discord не ответил. */
export type VoiceState = { available: false } | { available: true; invite: string | null; channels: VoiceChannel[] };

type WidgetMember = { username?: unknown; avatar_url?: unknown; channel_id?: unknown };
type WidgetChannel = { id?: unknown; name?: unknown; position?: unknown };

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/**
 * Разбирает ответ discord.com/api/guilds/{id}/widget.json. Поля проверяются по одному:
 * в виджете бывают и пустые аватарки, и люди в каналах, скрытых от @everyone.
 */
export function parseWidget(raw: unknown): VoiceState {
  if (!raw || typeof raw !== "object") return { available: false };
  const data = raw as { instant_invite?: unknown; channels?: unknown; members?: unknown };
  const channels = Array.isArray(data.channels) ? (data.channels as WidgetChannel[]) : [];
  const members = Array.isArray(data.members) ? (data.members as WidgetMember[]) : [];

  const byId = new Map<string, VoiceChannel & { position: number }>();
  for (const m of members) {
    const channelId = str(m?.channel_id);
    if (!channelId) continue;
    let channel = byId.get(channelId);
    if (!channel) {
      const meta = channels.find((c) => str(c?.id) === channelId);
      channel = {
        id: channelId,
        name: str(meta?.name) ?? "Голосовой канал",
        position: typeof meta?.position === "number" ? meta.position : Number.MAX_SAFE_INTEGER,
        people: [],
      };
      byId.set(channelId, channel);
    }
    channel.people.push({ username: str(m.username) ?? "Без имени", avatar_url: str(m.avatar_url) });
  }

  return {
    available: true,
    // Ссылку-приглашение кладём в href — берём только https, мало ли что придёт.
    invite: str(data.instant_invite)?.startsWith("https://") ? str(data.instant_invite) : null,
    channels: [...byId.values()].sort((a, b) => a.position - b.position).map(({ id, name, people }) => ({ id, name, people })),
  };
}
