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
  const plain = (value: string) => value.replace(/[\u00A0\u202F]/g, ' ');

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

  it('formats clock times with a leading zero, and compact dates', () => {
    language.use('en').subscribe();
    expect(format.clock('2026-10-31T08:05:00')).toBe('08:05');
    expect(format.shortDate('2026-10-31T08:05:00')).toBe('31/10/2026');
    expect(format.weekday(7)).toBe('Sunday');

    language.use('bg').subscribe();
    expect(format.clock('2026-10-31T08:05:00')).toBe('08:05');
  });

  it('formats short weekday names and capitalized month titles for calendars', () => {
    language.use('en').subscribe();
    expect([1, 2, 7].map(day => format.weekdayShort(day))).toEqual(['Mo', 'Tu', 'Su']);
    expect(format.monthYear(new Date(2026, 9, 1))).toBe('October 2026');

    language.use('bg').subscribe();
    expect([1, 2, 7].map(day => format.weekdayShort(day))).toEqual(['пн', 'вт', 'нд']);
    // Standalone month name, capitalized as a title.
    expect(format.monthYear(new Date(2026, 9, 1))).toBe('Октомври 2026');
    expect(format.monthYear(null)).toBe('—');
  });

  it('formats numbers with optional digits info and negative money', () => {
    language.use('en').subscribe();
    expect(format.number(1234.5)).toBe('1,234.5');
    expect(format.number(1234.5, '1.2-2')).toBe('1,234.50');
    expect(format.number(null)).toBe('—');
    expect(format.number(Number.NaN, undefined, 'n/a')).toBe('n/a');
    expect(format.money(-2050)).toBe('-€20.50');

    language.use('bg').subscribe();
    expect(plain(format.number(1234.5))).toBe('1 234,5');
  });
});
