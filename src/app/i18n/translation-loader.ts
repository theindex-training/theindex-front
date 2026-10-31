import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Loads public/i18n/<lang>.json through the bundler instead of over HTTP. The build emits each file
 * as its own content-hashed lazy chunk (outputHashing: "all"), so the URL changes whenever the text
 * changes: a deploy can never serve stale translations, and unchanged files stay cached.
 *
 * Bulgarian is not inlined into main.js to keep the initial bundle within budget; the app
 * initializer (provideI18n) still waits for it, so the first render is already translated.
 * See "Internationalization" in CLAUDE.md.
 */
@Injectable({ providedIn: 'root' })
export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Promise<Translation> {
    switch (lang) {
      case 'en':
        return import('../../../public/i18n/en.json').then(module => module.default);
      default:
        return import('../../../public/i18n/bg.json').then(module => module.default);
    }
  }
}
