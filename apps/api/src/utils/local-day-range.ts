const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface LocalDayRange {
  readonly start: Date;
  readonly end: Date;
}

function parseDateParts(
  date: string,
  tzOffsetMinutes: number
): { start: Date; end: Date } | null {
  if (!DATE_REGEX.test(date) || !Number.isFinite(tzOffsetMinutes)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const offsetMs = tzOffsetMinutes * 60_000;
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + offsetMs);
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) + offsetMs);
  return { start, end };
}

/** Inclusive local-day start (midnight). */
export function parseLocalDayStart(
  date: string,
  tzOffsetMinutes: number
): Date | null {
  return parseDateParts(date, tzOffsetMinutes)?.start ?? null;
}

/** Exclusive end bound for a local calendar day (next midnight). */
export function parseLocalDayEndExclusive(
  date: string,
  tzOffsetMinutes: number
): Date | null {
  return parseDateParts(date, tzOffsetMinutes)?.end ?? null;
}

/** Map a calendar date in the client's local timezone to UTC bounds. */
export function parseLocalDayRange(
  date: string,
  tzOffsetMinutes: number
): LocalDayRange | null {
  return parseDateParts(date, tzOffsetMinutes);
}
