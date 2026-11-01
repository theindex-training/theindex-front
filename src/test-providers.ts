import { registerLocaleData } from '@angular/common';
import localeBg from '@angular/common/locales/bg';
import localeEnGb from '@angular/common/locales/en-GB';
import { importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import bg from '../public/i18n/bg.json';
import en from '../public/i18n/en.json';
// Only this dependency-free token file may be imported from src/app here: importing app modules
// that specs also import breaks the shared test bundle (Angular linker/JIT error in every spec).
import { INITIAL_LANGUAGE } from './app/i18n/initial-language.token';

// Same as registerAppLocales() in i18n.providers.ts.
registerLocaleData(localeBg, 'bg');
registerLocaleData(localeEnGb, 'en-GB');

/**
 * Providers for every spec (angular.json → test.options.providersFile). Specs render with the real
 * translation files in English, so assertions read naturally; a spec can switch with
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
  { provide: INITIAL_LANGUAGE, useValue: 'en' }
];
