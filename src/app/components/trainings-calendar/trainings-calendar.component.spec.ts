import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../i18n/language.service';
import { i18nMessage } from '../../i18n/ui-message';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import { PageDriver, driver } from '../../../testing/dom';
import { TrainingsCalendarComponent } from './trainings-calendar.component';

function training(
  id: string,
  trainedAt: string,
  overrides: Partial<AttendanceTraineeTrainingItem> = {}
): AttendanceTraineeTrainingItem {
  return {
    id,
    traineeId: 't1',
    trainerId: 'tr1',
    trainer: { id: 'tr1', name: 'Petar Ivanov', nickname: 'Pepi' },
    locationId: 'g1',
    location: { id: 'g1', name: 'Center' },
    trainedAt,
    subscriptionId: null,
    gymSubscriptionId: null,
    paymentStatus: 'PAID',
    createdAt: trainedAt,
    ...overrides
  };
}

const maria = { trainer: { id: 'tr2', name: 'Maria Koleva', nickname: null }, location: { id: 'g2', name: 'Lozenets' } };

/** October 2026 in Sofia (UTC+3 until 25 Oct, UTC+2 after). */
const october = [
  training('a1', '2026-10-01T15:30:00Z'),
  training('a2', '2026-10-07T15:30:00Z', { ...maria, paymentStatus: 'UNPAID' }),
  training('a3', '2026-10-07T04:00:00Z'),
  training('a4', '2026-10-07T17:00:00Z'),
  training('a5', '2026-10-20T15:30:00Z', { paymentStatus: 'UNPAID' })
];

describe('TrainingsCalendarComponent', () => {
  let fixture: ComponentFixture<TrainingsCalendarComponent>;
  let page: PageDriver;

  beforeEach(() => {
    // 00:30 on Sunday 1 Nov in Sofia, still 31 Oct in UTC.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-31T22:30:00Z') });
  });

  afterEach(() => vi.useRealTimers());

  async function render(trainings: AttendanceTraineeTrainingItem[], inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(TrainingsCalendarComponent);
    fixture.componentRef.setInput('trainings', trainings);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
  }

  const text = (testId: string) => page.query(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
  const day = (key: string) => page.query<HTMLButtonElement>(`[data-testid="calendar-day-${key}"]`)!;
  const plain = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();
  const parts = (root: Element, selector: string) =>
    Array.from(root.querySelectorAll(selector)).map(item => plain(item.textContent)).join(' | ');
  /** What a desktop cell shows: day number, then each training's lines, then "+N more". */
  const dayText = (key: string) => parts(day(key), '.cal-day__num, .cal-event__line, .cal-more');
  const panelRecords = () =>
    page
      .queryAll('[data-testid="calendar-panel"] li.record')
      .map(row => parts(row, '.record__title, .record__meta, app-chip'));
  const button = (label: string) =>
    page.queryAll<HTMLButtonElement>('button').find(item => item.textContent.trim() === label)!;
  const goToOctober = () => page.click('[data-testid="calendar-previous"]');

  it("opens on the current local month, with today marked and the Today button disabled", async () => {
    await render([]);

    expect(text('calendar-month')).toBe('November 2026');
    expect(day('2026-11-01').getAttribute('aria-current')).toBe('date');
    expect(day('2026-11-01').classList).toContain('is-today');
    expect(day('2026-11-02').getAttribute('aria-current')).toBeNull();
    expect(button('Today').disabled).toBe(true);
  });

  it('lays the month out in Monday-first weeks', async () => {
    await render([]);

    const headers = page.queryAll('thead th').map(th => th.querySelector('.visually-hidden')!.textContent);
    expect(headers).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    const rows = page.queryAll('tbody tr').map(row =>
      Array.from(row.querySelectorAll('td')).map(cell => cell.querySelector('button')?.getAttribute('data-day') ?? null)
    );
    // 1 Nov 2026 is a Sunday: six empty cells first; 30 Nov (Monday) starts the sixth week.
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(rows[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });

  it('places a training on its local day, not its UTC day', async () => {
    await render([training('late', '2026-10-31T22:15:00Z')]);

    expect(day('2026-11-01').getAttribute('aria-label')).toBe('Sunday, 1 November 2026, 1 training');
    expect(dayText('2026-11-01')).toBe('1 | 00:15 Pepi | Center');
    await goToOctober();
    expect(day('2026-10-31').getAttribute('aria-label')).toBe('Saturday, 31 October 2026, no trainings');
  });

  it('shows time, trainer and gym in each cell, earliest first, marked paid or unpaid', async () => {
    await render(october);
    await goToOctober();

    expect(text('calendar-month')).toBe('October 2026');
    expect(dayText('2026-10-01')).toBe('1 | 18:30 Pepi | Center');
    // Three trainings: the first two by time, then "+1 more".
    expect(dayText('2026-10-07')).toBe('7 | 07:00 Pepi | Center | 18:30 Maria Koleva | Lozenets | +1 more');

    const events = Array.from(day('2026-10-07').querySelectorAll('.cal-event'));
    expect(events.map(event => event.classList.contains('cal-event--unpaid'))).toEqual([false, true]);
    // Phone markers: one per training, in time order; unpaid ones are diamonds.
    const markers = Array.from(day('2026-10-07').querySelectorAll('.cal-marks .mark'));
    expect(markers.map(marker => marker.classList.contains('mark--unpaid'))).toEqual([false, true, false]);
    expect(day('2026-10-20').querySelector('.cal-marks .mark--unpaid')).not.toBeNull();
    expect(day('2026-10-02').querySelector('.mark')).toBeNull();
  });

  it('announces each day with its training and unpaid counts', async () => {
    await render(october);
    await goToOctober();

    expect(day('2026-10-07').getAttribute('aria-label')).toBe('Wednesday, 7 October 2026, 3 trainings, 1 unpaid');
    expect(day('2026-10-01').getAttribute('aria-label')).toBe('Thursday, 1 October 2026, 1 training');
    expect(day('2026-10-20').getAttribute('aria-label')).toBe('Tuesday, 20 October 2026, 1 training, 1 unpaid');
  });

  it("explains the colors in a legend", async () => {
    await render(october);

    const legend = page.query('ul.cal-legend')!;
    expect(legend.getAttribute('aria-label')).toBe('Legend');
    expect(Array.from(legend.querySelectorAll('li')).map(item => item.textContent.trim())).toEqual([
      'Paid training',
      'Unpaid training',
      'Today'
    ]);
    expect(legend.querySelectorAll('.mark--unpaid')).toHaveLength(1);
  });

  it("summarizes only the shown month's trainings", async () => {
    await render([...october, training('n1', '2026-11-02T15:30:00Z')]);

    expect(text('calendar-summary')).toBe('1 training · 1 paid · 0 unpaid');
    await goToOctober();
    expect(text('calendar-summary')).toBe('5 trainings · 3 paid · 2 unpaid');
    await page.click('[data-testid="calendar-previous"]');
    expect(text('calendar-summary')).toBe('No trainings in this month.');
  });

  it('says there are no trainings at all with the empty key, and still shows the month', async () => {
    await render([], { emptyKey: 'traineeDashboard.noTrainings' });

    expect(text('calendar-summary')).toBe('No trainings yet.');
    expect(day('2026-11-15')).not.toBeNull();
  });

  it('moves between months across the year end, and Today comes back', async () => {
    await render([]);

    await page.click('[data-testid="calendar-next"]');
    await page.click('[data-testid="calendar-next"]');
    expect(text('calendar-month')).toBe('January 2027');
    expect(day('2027-01-31')).not.toBeNull();
    expect(button('Today').disabled).toBe(false);

    await page.click('[data-testid="calendar-previous"]');
    expect(text('calendar-month')).toBe('December 2026');

    button('Today').click();
    await page.settle();
    expect(text('calendar-month')).toBe('November 2026');
    expect(button('Today').disabled).toBe(true);
  });

  it("lists the selected day's trainings below the grid, and toggles the selection", async () => {
    await render(october);
    await goToOctober();

    await page.click('[data-testid="calendar-day-2026-10-07"]');
    expect(day('2026-10-07').getAttribute('aria-pressed')).toBe('true');
    expect(day('2026-10-07').classList).toContain('is-selected');
    expect(page.query('.cal-panel__title')!.textContent.trim()).toBe('Wednesday, 7 October 2026');
    expect(panelRecords()).toEqual([
      '07:00 | Pepi · Center | Paid',
      '18:30 | Maria Koleva · Lozenets | Unpaid',
      '20:00 | Pepi · Center | Paid'
    ]);

    await page.click('[data-testid="calendar-day-2026-10-07"]');
    expect(day('2026-10-07').getAttribute('aria-pressed')).toBe('false');
    expect(page.query('.cal-panel__title')!.textContent.trim()).toBe('Trainings in October 2026');
  });

  it('says when a selected day has no trainings, and "Clear selection" clears it', async () => {
    await render(october);
    await goToOctober();

    await page.click('[data-testid="calendar-day-2026-10-02"]');
    expect(text('calendar-panel')).toBe('Friday, 2 October 2026 Clear selection No trainings on this day.');

    await page.click('.cal-panel__header button');
    expect(day('2026-10-02').getAttribute('aria-pressed')).toBe('false');
    expect(page.query('[data-testid="calendar-panel"]')!.classList).toContain('cal-panel--month');
  });

  it('lists the whole month by day when nothing is selected (shown on phones)', async () => {
    await render(october);
    await goToOctober();

    const panel = page.query('[data-testid="calendar-panel"]')!;
    expect(panel.classList).toContain('cal-panel--month');
    expect(page.queryAll('.cal-panel__day').map(heading => heading.textContent.trim())).toEqual([
      'Thursday, 1 October 2026',
      'Wednesday, 7 October 2026',
      'Tuesday, 20 October 2026'
    ]);
    expect(panelRecords()).toHaveLength(5);
  });

  it('clears the selection when the month changes', async () => {
    await render(october);
    await goToOctober();
    await page.click('[data-testid="calendar-day-2026-10-07"]');

    await page.click('[data-testid="calendar-next"]');
    await goToOctober();
    expect(day('2026-10-07').getAttribute('aria-pressed')).toBe('false');
    expect(page.query('.cal-panel__header')).toBeNull();
  });

  it('keeps one tab stop on the grid and moves it with the keyboard, across months', async () => {
    await render([]);
    const tabStops = () => page.queryAll('button[data-day][tabindex="0"]').map(item => item.getAttribute('data-day'));
    const press = async (key: string) => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await page.settle();
    };

    expect(tabStops()).toEqual(['2026-11-01']);
    day('2026-11-01').focus();

    await press('ArrowRight');
    expect(tabStops()).toEqual(['2026-11-02']);
    expect(document.activeElement).toBe(day('2026-11-02'));

    await press('ArrowDown');
    expect(document.activeElement).toBe(day('2026-11-09'));
    await press('End');
    expect(document.activeElement).toBe(day('2026-11-15'));
    await press('Home');
    expect(document.activeElement).toBe(day('2026-11-09'));

    // Leaving the month shows the neighbouring one.
    await press('ArrowUp');
    await press('ArrowUp');
    expect(text('calendar-month')).toBe('October 2026');
    expect(document.activeElement).toBe(day('2026-10-26'));

    await press('PageDown');
    expect(text('calendar-month')).toBe('November 2026');
    expect(document.activeElement).toBe(day('2026-11-26'));

    // Enter/Space are the native button click; selecting keeps the tab stop on that day.
    day('2026-11-26').click();
    await page.settle();
    expect(day('2026-11-26').getAttribute('aria-pressed')).toBe('true');
    expect(tabStops()).toEqual(['2026-11-26']);
  });

  it('clears the selection when the keyboard moves into another month', async () => {
    await render(october);
    await goToOctober();
    await page.click('[data-testid="calendar-day-2026-10-07"]');
    day('2026-10-07').focus();

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await page.settle();
    // Within the month the selection stays.
    expect(day('2026-10-07').getAttribute('aria-pressed')).toBe('true');

    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await page.settle();
    expect(text('calendar-month')).toBe('November 2026');
    expect(page.query('.cal-panel__header')).toBeNull();
    expect(page.query('[data-testid="calendar-panel"]')!.classList).toContain('cal-panel--month');
    expect(document.activeElement).toBe(day('2026-11-08'));
  });

  it('clamps PageUp to the last day of a shorter month', async () => {
    await render([]);
    await page.click('[data-testid="calendar-next"]');
    await page.click('[data-testid="calendar-next"]');
    await page.click('[data-testid="calendar-next"]');
    await page.click('[data-testid="calendar-next"]');
    expect(text('calendar-month')).toBe('March 2027');

    // The tab stop is on 1 March (today isn't in this month). Move to 30 March, then a month back.
    day('2027-03-01').focus();
    for (let i = 0; i < 4; i++) {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await page.settle();
    }
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await page.settle();
    expect(document.activeElement).toBe(day('2027-03-30'));
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    await page.settle();

    expect(text('calendar-month')).toBe('February 2027');
    expect(document.activeElement).toBe(day('2027-02-28'));
  });

  it('shows a loading placeholder, then an error instead of the grid', async () => {
    await render([], { loading: true });
    expect(page.query('[role="status"]')!.textContent).toContain('Loading trainings');
    expect(page.query('table')).toBeNull();

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', i18nMessage('traineeDashboard.loadError'));
    await page.settle();
    expect(page.alert()).toBe('Unable to load your dashboard right now. Please try again later.');
    expect(page.query('table')).toBeNull();
  });

  it('renders in Bulgarian, with Bulgarian plurals', async () => {
    const language = TestBed.inject(LanguageService);
    language.use('bg').subscribe();
    await render(october);
    await goToOctober();

    expect(text('calendar-month')).toBe('Октомври 2026');
    expect(page.queryAll('thead th span[aria-hidden]').map(span => span.textContent)).toEqual(
      ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд']
    );
    expect(text('calendar-summary')).toBe('5 тренировки · 3 платени · 2 неплатени');
    // Intl puts a no-break space before "г."; plain() turns it into a space.
    expect(plain(day('2026-10-07').getAttribute('aria-label'))).toBe(
      'сряда, 7 октомври 2026 г., 3 тренировки, 1 неплатена'
    );
    expect(plain(day('2026-10-01').getAttribute('aria-label'))).toBe(
      'четвъртък, 1 октомври 2026 г., 1 тренировка'
    );
    language.use('en').subscribe();
  });
});
