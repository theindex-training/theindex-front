import { InjectionToken } from '@angular/core';

/**
 * Overrides the language LanguageService starts with (normally the stored choice, or Bulgarian).
 * Only the test setup provides it, to render specs in English. Kept in its own file without other
 * imports, so the spec providers file doesn't pull app modules into the shared test bundle.
 */
export const INITIAL_LANGUAGE = new InjectionToken<'bg' | 'en'>('INITIAL_LANGUAGE');
