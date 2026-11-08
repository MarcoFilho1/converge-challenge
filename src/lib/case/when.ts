const TZ = "America/Recife";

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** "hoje, 23:41", "ontem, 17:12" ou "05/11, 10:00", sempre no horário de Recife. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(d) === dayKey(now)) return `hoje, ${time}`;
  if (dayKey(d) === dayKey(yesterday)) return `ontem, ${time}`;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
  return `${date}, ${time}`;
}
