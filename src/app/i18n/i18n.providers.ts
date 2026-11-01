import { registerLocaleData } from '@angular/common';
import localeBg from '@angular/common/locales/bg';
import localeEnGb from '@angular/common/locales/en-GB';
import {
  EnvironmentProviders,
  Provider,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer
} from '@angular/core';
import { TitleStrategy } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { DEFAULT_LANGUAGE, LANGUAGES, LanguageService } from './language.service';
import { BundledTranslationLoader } from './translation-loader';
import { TranslatedTitleStrategy } from './translated-title.strategy';

/** Angular locale data for the two UI languages (see LOCALE_IDS). */
export function registerAppLocales(): void {
  registerLocaleData(localeBg, 'bg');
  registerLocaleData(localeEnGb, 'en-GB');
}

/** Runtime translations (Transloco + ICU plurals), locale data and translated page titles. */
export function provideI18n(): EnvironmentProviders {
  registerAppLocales();
  const providers: (Provider | EnvironmentProviders)[] = [
    provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { logMissingKey: isDevMode() }
      },
      loader: BundledTranslationLoader
    }),
    // ICU message syntax, e.g. "{count, plural, one {# трениращ} other {# трениращи}}".
    provideTranslocoMessageformat({ locales: DEFAULT_LANGUAGE }),
    // Bootstrap waits for this, so the first render is already translated (no flash of keys).
    provideAppInitializer(() => inject(LanguageService).init()),
    { provide: TitleStrategy, useClass: TranslatedTitleStrategy }
  ];
  return makeEnvironmentProviders(providers);
}
