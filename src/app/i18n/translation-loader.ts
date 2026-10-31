import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
// Bulgarian is the default for everyone, so it ships in the main bundle: no extra request before the
// first render. English is a separate lazy chunk, fetched the first time someone switches.
import bg from '../../../public/i18n/bg.json';

/**
 * Loads public/i18n/<lang>.json through the bundler instead of over HTTP. The build emits each file
 * as a content-hashed chunk (outputHashing: "all"), so a deploy changes the URL whenever the text
 * changes and browsers can never serve stale translations. See "Internationalization" in CLAUDE.md.
 */
@Injectable({ providedIn: 'root' })
export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    switch (lang) {
      case 'en':
        return import('../../../public/i18n/en.json').then(module => module.default);
      default:
        return Promise.resolve(bg);
    }
  }
}
