import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';
import { LocaleFormatService } from './locale-format.service';

describe('LocaleFormatService', () => {
  let language: LanguageService;
  let format: LocaleFormatService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    language = TestBed.inject(LanguageService);
    format = TestBed.inject(LocaleFormatService);
  });

  // Intl uses narrow no-break spaces in some locales; compare with plain spaces.
  const plain = (value: string) => value.replace(/[  ]/g, ' ');

  it('formats EUR money from cents in the active language', () => {
    language.use('bg').subscribe();
    expect(plain(format.money(4550))).toBe('45,50 €');
    expect(plain(format.money(123456))).toBe('1 234,56 €');

    language.use('en').subscribe();
    expect(format.money(4550)).toBe('€45.50');
    expect(format.money(123456)).toBe('€1,234.56');
  });

  it('formats dates, times and weekdays in the active language', () => {
    const value = '2026-10-31T18:30:00';

    language.use('bg').subscribe();
    expect(plain(format.date(value))).toBe('31.10.2026 г.');
    expect(plain(format.time(value))).toBe('18:30');
    expect(plain(format.dateTime(value))).toBe('31.10.2026 г., 18:30');
    expect(format.weekday(1)).toBe('Понеделник');
    expect(format.weekday(7)).toBe('Неделя');

    language.use('en').subscribe();
    expect(format.date(value)).toBe('31 Oct 2026');
    expect(format.time(value)).toBe('18:30');
    expect(format.weekday(1)).toBe('Monday');
  });

  it('formats date-only API values without a timezone shift', () => {
    language.use('bg').subscribe();
    expect(plain(format.date('2026-10-01'))).toBe('1.10.2026 г.');
  });

  it('uses a fallback for missing or invalid values', () => {
    expect(format.date(null)).toBe('—');
    expect(format.dateTime('not a date')).toBe('—');
    expect(format.money(undefined)).toBe('—');
  });
});
