import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { TranslationParams } from './ui-message';
import { Observable, map, tap } from 'rxjs';

export type Language = 'bg' | 'en';

// Keep in sync with the inline script in src/index.html, which sets <html lang> before Angular boots.
export const LANGUAGE_STORAGE_KEY = 'lang';
export const DEFAULT_LANGUAGE: Language = 'bg';
export const LANGUAGES: readonly Language[] = ['bg', 'en'];

/** Angular locale ids (registered in i18n.providers.ts) used for dates, numbers and money. */
export const LOCALE_IDS: Record<Language, string> = {
  bg: 'bg',
  en: 'en-GB'
};

export function isLanguage(value: unknown): value is Language {
  return value === 'bg' || value === 'en';
}

/**
 * The UI language. Bulgarian is the default whatever the browser language; an explicit choice is
 * stored in localStorage. Mirrors ThemeService. Switching loads the translation file first and then
 * flips the language in one go, so the page never shows raw keys or a half-translated mix.
 */
@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  private readonly langSignal = signal<Language>(readStoredLanguage());

  /** The active language. Read it in templates/computeds to re-render when it changes. */
  readonly lang = this.langSignal.asReadonly();

  /** Angular locale id for the active language, e.g. for formatDate(). */
  locale(): string {
    return LOCALE_IDS[this.langSignal()];
  }

  /**
   * Translates a key in the active language. It reads the language signal, so a template helper that
   * calls it (e.g. `statusLabel(item)`) re-renders on a switch. For text shown later, store a
   * UiMessage instead of a translated string.
   */
  t(key: string, params?: TranslationParams): string {
    this.langSignal();
    return this.transloco.translate(key, params);
  }

  /** Loads the stored (or default) language. Runs as an app initializer, before the first render. */
  init(): Observable<void> {
    return this.use(this.langSignal());
  }

  setLanguage(lang: Language): void {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the choice then lasts for this visit.
    }
    this.use(lang).subscribe();
  }

  toggle(): void {
    this.setLanguage(this.langSignal() === 'bg' ? 'en' : 'bg');
  }

  /** Loads and applies a language without saving it as the user's choice (setLanguage saves it). */
  use(lang: Language): Observable<void> {
    return this.transloco.load(lang).pipe(
      tap(() => {
        this.transloco.setActiveLang(lang);
        this.langSignal.set(lang);
        this.document.documentElement.lang = lang;
      }),
      map(() => undefined)
    );
  }
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
