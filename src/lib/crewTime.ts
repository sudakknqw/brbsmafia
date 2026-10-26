import "server-only";

/**
 * The crew time zone. It defines a session's gaming day (gatherings.day is unique),
 * the Discord message and reminders, so people in different time zones agree on the session date.
 */
export function crewTimezone(): string {
  return process.env.CREW_TIMEZONE || "Europe/Moscow";
}
