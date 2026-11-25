import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TestRole, signInAs } from '../../testing/jwt';
import {
  ADVENT_OPEN_DELAY,
  AdventCalendarComponent,
} from './advent-calendar.component';
import { HOLIDAY_CLOCK } from './holiday-clock.token';
import { HOLIDAY_STORAGE_KEY } from './holiday.service';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<
  string,
  unknown
>;

async function render(
  isoTime: string,
  role: TestRole = 'TRAINEE',
): Promise<ComponentFixture<AdventCalendarComponent>> {
  signInAs(role);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: HOLIDAY_CLOCK, useValue: () => new Date(isoTime) },
      { provide: ADVENT_OPEN_DELAY, useValue: 0 },
    ],
  });
  const fixture = TestBed.createComponent(AdventCalendarComponent);
  await fixture.whenStable();
  return fixture;
}

const door = (fixture: ComponentFixture<unknown>, day: number) =>
  (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    `[data-testid="advent-door-${day}"]`,
  )!;
const text = (fixture: ComponentFixture<unknown>, testId: string) =>
  (fixture.nativeElement as HTMLElement)
    .querySelector(`[data-testid="${testId}"]`)
    ?.textContent?.replace(/\s+/g, ' ')
    .trim();
const dialog = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('dialog')!;

describe('AdventCalendarComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  });

  afterEach(() => {
    delete dialogProto['showModal'];
    delete dialogProto['close'];
    document.documentElement.removeAttribute('data-holiday-snow');
  });

  it('is not shown outside December', async () => {
    const fixture = await render('2027-01-02T10:00:00+02:00');
    expect(text(fixture, 'advent-calendar')).toBeUndefined();
  });

  it('shows 24 mixed-up doors: those up to today open, later ones locked', async () => {
    const fixture = await render('2026-12-05T08:00:00+02:00');
    const days = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[data-testid^="advent-door-"]',
      ),
    ).map((button) => Number(button.getAttribute('data-testid')!.slice(12)));
    expect(days).toHaveLength(24);
    expect(days.slice(0, 4)).toEqual([13, 7, 22, 2]);
    expect(days.at(-1)).toBe(24);

    expect(text(fixture, 'advent-count')).toBe('0 of 5 doors open');
    expect(door(fixture, 5).getAttribute('aria-label')).toBe(
      '5 December, today’s door',
    );
    expect(door(fixture, 3).getAttribute('aria-label')).toBe('3 December');
    expect(door(fixture, 3).getAttribute('aria-disabled')).toBeNull();
    expect(door(fixture, 6).getAttribute('aria-label')).toBe(
      'Opens on 6 December',
    );
    expect(door(fixture, 6).getAttribute('aria-disabled')).toBe('true');
  });

  it('opens a door: shows what is behind it and remembers it', async () => {
    const fixture = await render('2026-12-05T08:00:00+02:00');
    door(fixture, 5).click();
    await fixture.whenStable();

    expect(dialog(fixture).hasAttribute('open')).toBe(true);
    expect(text(fixture, 'advent-door-text')).toBe(
      'Mini challenge: 20 air squats while the kettle boils.',
    );
    expect(dialog(fixture).textContent).toContain('Challenge');
    expect(door(fixture, 5).getAttribute('aria-label')).toBe(
      '5 December, opened',
    );
    expect(text(fixture, 'advent-count')).toBe('1 of 5 doors open');
    expect(JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY)!)).toEqual({
      season: 2026,
      doors: [5],
    });
  });

  it('lets a missed door be opened later', async () => {
    const fixture = await render('2026-12-05T08:00:00+02:00');
    door(fixture, 1).click();
    await fixture.whenStable();
    expect(text(fixture, 'advent-door-text')).toContain(
      'Welcome to the Advent calendar!',
    );
  });

  it('keeps a later door shut and says when it opens', async () => {
    const fixture = await render('2026-12-05T08:00:00+02:00');
    door(fixture, 6).click();
    await fixture.whenStable();

    expect(dialog(fixture).hasAttribute('open')).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Opens on 6 December');
    expect(localStorage.getItem(HOLIDAY_STORAGE_KEY)).toBeNull();
  });

  it('shows the doors opened earlier as open', async () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, doors: [2, 4] }),
    );
    const fixture = await render('2026-12-05T08:00:00+02:00');
    expect(text(fixture, 'advent-count')).toBe('2 of 5 doors open');
    expect(door(fixture, 4).classList).toContain('is-open');
    expect(door(fixture, 5).classList).not.toContain('is-open');
  });

  it('links a trainee from a door to the page it talks about', async () => {
    const fixture = await render('2026-12-05T08:00:00+02:00');
    door(fixture, 2).click();
    await fixture.whenStable();
    const link = dialog(fixture).querySelector('a');
    expect(link?.textContent?.trim()).toBe('Book a training');
    expect(link?.getAttribute('href')).toBe('/schedule');
  });

  it('shows staff the same doors, without links to trainees’ pages', async () => {
    const fixture = await render('2026-12-08T08:00:00+02:00', 'TRAINER');
    door(fixture, 2).click();
    await fixture.whenStable();
    expect(dialog(fixture).querySelector('a')).toBeNull();

    door(fixture, 7).click();
    await fixture.whenStable();
    expect(dialog(fixture).querySelector('a')?.getAttribute('href')).toBe(
      '/records',
    );
  });

  it('opens every door from Christmas Eve to the end of December', async () => {
    const fixture = await render('2026-12-28T08:00:00+02:00');
    expect(text(fixture, 'advent-count')).toBe('0 of 24 doors open');
    expect(door(fixture, 24).getAttribute('aria-label')).toBe('24 December');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.is-today'),
    ).toBeNull();
  });
});
