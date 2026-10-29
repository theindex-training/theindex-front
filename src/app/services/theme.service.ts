import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

// Keep in sync with the inline script in src/index.html, which applies the theme before Angular boots.
export const THEME_STORAGE_KEY = 'theme';
const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly mediaQuery = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');

  private readonly systemPrefersDark = signal(this.mediaQuery?.matches ?? false);
  private readonly modeSignal = signal<ThemeMode>(this.readStoredMode());

  /** The user's choice: an explicit theme, or follow the OS. */
  readonly mode = this.modeSignal.asReadonly();

  /** The theme actually applied to the page. */
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const mode = this.modeSignal();
    if (mode === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return mode;
  });

  constructor() {
    this.mediaQuery?.addEventListener('change', event => this.systemPrefersDark.set(event.matches));

    effect(() => {
      const theme = this.resolvedTheme();
      const root = this.document.documentElement;
      root.setAttribute('data-theme', theme);
      // The inline script sets color-scheme inline, so it must be kept in sync here too.
      root.style.colorScheme = theme;
    });
  }

  setMode(mode: ThemeMode): void {
    this.modeSignal.set(mode);
    try {
      if (mode === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    } catch {
      // Storage can be unavailable (private mode, blocked cookies); the choice then lasts for this visit.
    }
  }

  /** Cycles light -> dark -> system. */
  cycleMode(): void {
    const next = THEME_MODES[(THEME_MODES.indexOf(this.modeSignal()) + 1) % THEME_MODES.length];
    this.setMode(next);
  }

  private readStoredMode(): ThemeMode {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
