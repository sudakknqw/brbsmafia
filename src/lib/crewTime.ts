import "server-only";

/**
 * Часовой пояс компании. По нему считается игровой день сессии (gatherings.day уникален),
 * сообщение в Discord и напоминания — чтобы у людей из разных поясов дата сессии совпадала.
 */
export function crewTimezone(): string {
  return process.env.CREW_TIMEZONE || "Europe/Moscow";
}
