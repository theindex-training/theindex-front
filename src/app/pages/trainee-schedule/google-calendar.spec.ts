import { calendarInstant, googleCalendarUrl } from './google-calendar';

describe('googleCalendarUrl', () => {
  it('fills in the title, the UTC times, the place and the details', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'CrossFit тренировка',
        startsAt: '2026-10-20T04:10:00.000Z',
        endsAt: '2026-10-20T05:10:00Z',
        location: 'ул. Ранни лист N13, Пловдив',
        details: 'Групов инструктор: Красимир Пейков\nhttps://x.test/a?b=1&c=2',
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'CrossFit тренировка',
      dates: '20261020T041000Z/20261020T051000Z',
      location: 'ул. Ранни лист N13, Пловдив',
      details: 'Групов инструктор: Красимир Пейков\nhttps://x.test/a?b=1&c=2',
    });
    // Every value is encoded, the slash between the times included.
    expect(url.search).toContain('dates=20261020T041000Z%2F20261020T051000Z');
    expect(url.search).not.toContain(' ');
  });

  it('leaves out empty fields', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'CrossFit training',
        startsAt: '2026-11-13T16:00:00Z',
        endsAt: '2026-11-13T17:00:00Z',
        location: '',
        details: '',
      }),
    );

    expect([...url.searchParams.keys()]).toEqual(['action', 'text', 'dates']);
  });
});

describe('calendarInstant', () => {
  it('writes an instant in UTC without separators or milliseconds', () => {
    expect(calendarInstant('2026-11-13T18:00:00+02:00')).toBe(
      '20261113T160000Z',
    );
  });
});
