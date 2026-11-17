/** An event to add to Google Calendar. */
export interface CalendarEvent {
  title: string;
  /** ISO instants, as the API gives them. */
  startsAt: string;
  endsAt: string;
  location: string;
  /** Plain text; line breaks are kept. */
  details: string;
}

/** `20261020T051000Z`: the UTC form Google Calendar's `dates` takes. */
export function calendarInstant(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The link that opens Google Calendar with the event filled in, for the user to save
 * (`calendar/render?action=TEMPLATE`). Times go as UTC, so the event is right in any time zone.
 * The template can't set reminders: the calendar's own default notifications apply.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
    [
      'dates',
      `${calendarInstant(event.startsAt)}/${calendarInstant(event.endsAt)}`,
    ],
    ['location', event.location],
    ['details', event.details],
  ]
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `https://calendar.google.com/calendar/render?${params}`;
}
