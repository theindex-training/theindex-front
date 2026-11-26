import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HOLIDAY_CLOCK } from './holiday-clock.token';
import { HOLIDAY_STORAGE_KEY, HolidayService } from './holiday.service';
import { SurvachkaDialogComponent } from './survachka-dialog.component';

const dialogProto = HTMLDialogElement.prototype as unknown as Record<
  string,
  unknown
>;

async function render(
  isoTime: string,
): Promise<ComponentFixture<SurvachkaDialogComponent>> {
  TestBed.configureTestingModule({
    providers: [{ provide: HOLIDAY_CLOCK, useValue: () => new Date(isoTime) }],
  });
  const fixture = TestBed.createComponent(SurvachkaDialogComponent);
  await fixture.whenStable();
  return fixture;
}

const dialog = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
const wish = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="survachka-wish"]',
  )?.textContent;

describe('SurvachkaDialogComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });

  afterEach(() => {
    delete dialogProto['showModal'];
    delete dialogProto['close'];
    document.documentElement.removeAttribute('data-holiday-snow');
  });

  it('greets with the wish the first time the app is opened in the new year', async () => {
    const fixture = await render('2027-01-01T09:00:00+02:00');
    expect(dialog(fixture).hasAttribute('open')).toBe(true);
    expect(dialog(fixture).textContent).toContain('Happy New Year!');
    expect(wish(fixture)).toContain('Surva, surva, happy year,');
    expect(wish(fixture)).toContain('till next year, and amen to you!');
  });

  it('closes for the season with its button', async () => {
    const fixture = await render('2027-01-01T09:00:00+02:00');
    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.btn',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(dialog(fixture).hasAttribute('open')).toBe(false);
    expect(JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY)!)).toEqual({
      season: 2026,
      survachka: true,
    });
  });

  it('opens again when the сурвачка on the logo is tapped', async () => {
    localStorage.setItem(
      HOLIDAY_STORAGE_KEY,
      JSON.stringify({ season: 2026, survachka: true }),
    );
    const fixture = await render('2027-01-03T09:00:00+02:00');
    expect(dialog(fixture).hasAttribute('open')).toBe(false);
    TestBed.inject(HolidayService).openSurvachka();
    await fixture.whenStable();
    expect(dialog(fixture).hasAttribute('open')).toBe(true);
  });

  it('stays shut on New Year’s Eve', async () => {
    const fixture = await render('2026-12-31T22:00:00+02:00');
    expect(dialog(fixture).hasAttribute('open')).toBe(false);
  });
});
