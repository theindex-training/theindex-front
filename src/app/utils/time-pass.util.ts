/**
 * The last instant a TIME pass covers. The API's `endsAt` is exclusive: a month pass from
 * Nov 23 ends Dec 23 at 00:00, so its last day is Dec 22. Show a pass's end as the day of
 * this, never `endsAt` itself (theindex-api `timePassLastInstant`). Null without an end.
 */
export function timePassLastDay(
  endsAt: string | Date | null | undefined,
): Date | null {
  if (!endsAt) {
    return null;
  }
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
  return Number.isNaN(end.getTime()) ? null : new Date(end.getTime() - 1);
}
