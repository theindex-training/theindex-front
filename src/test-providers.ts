import { importProvidersFrom, inject, provideAppInitializer } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import bg from '../public/i18n/bg.json';
import en from '../public/i18n/en.json';
import { LanguageService } from './app/i18n/language.service';
import { registerAppLocales } from './app/i18n/i18n.providers';

registerAppLocales();

/**
 * Providers for every spec (angular.json → test.options.providersFile). Specs render with the real
 * translation files in English, so assertions read naturally; a spec can switch to Bulgarian with
 * `TestBed.inject(LanguageService).use('bg')`.
 */
export default [
  importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { bg, en },
      translocoConfig: { availableLangs: ['bg', 'en'], defaultLang: 'en' },
      preloadLangs: true
    })
  ),
  provideTranslocoMessageformat({ locales: 'en' }),
  provideAppInitializer(() => inject(LanguageService).use('en'))
];
