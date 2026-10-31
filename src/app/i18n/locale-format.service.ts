import {
  formatCurrency,
  formatDate,
  formatNumber,
  getCurrencySymbol
} from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { LanguageService } from './language.service';

type DateInput = string | number | Date | null | undefined;

/**
 * Dates, times, numbers and money in the active language (Angular locale data for "bg" and "en-GB").
 * Every method reads the language signal, so a template that calls one re-renders when the language
 * changes. Money arrives from the API as integer cents and is always EUR.
 */
@Injectable({ providedIn: 'root' })
export class LocaleFormatService {
  private readonly language = inject(LanguageService);

  /** 31.10.2026 г. / 31 Oct 2026 */
  date(value: DateInput, fallback = '—'): string {
    return this.format(value, 'mediumDate', fallback);
  }

  /** 31.10.2026 г., 18:30 ч. / 31 Oct 2026, 18:30 */
  dateTime(value: DateInput, fallback = '—'): string {
    if (!isValidDate(value)) {
      return fallback;
    }
    return `${this.format(value, 'mediumDate')}, ${this.format(value, 'shortTime')}`;
  }

  /** 18:30 ч. / 18:30 */
  time(value: DateInput, fallback = '—'): string {
    return this.format(value, 'shortTime', fallback);
  }

  /** Any Angular date format, e.g. "EEEE" for the weekday name. */
  custom(value: DateInput, format: string, fallback = '—'): string {
    return this.format(value, format, fallback);
  }

  number(value: number | null | undefined, digitsInfo?: string, fallback = '—'): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return fallback;
    }
    return formatNumber(value, this.language.locale(), digitsInfo);
  }

  /** 1 234,50 € / €1,234.50 */
  money(cents: number | null | undefined, fallback = '—'): string {
    if (cents === null || cents === undefined || Number.isNaN(cents)) {
      return fallback;
    }
    const locale = this.language.locale();
    return formatCurrency(cents / 100, locale, getCurrencySymbol('EUR', 'narrow', locale), 'EUR');
  }

  private format(value: DateInput, format: string, fallback = '—'): string {
    if (!isValidDate(value)) {
      return fallback;
    }
    return formatDate(value as string | number | Date, format, this.language.locale());
  }
}

function isValidDate(value: DateInput): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}
