import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';

/**
 * Route `title`s are translation keys. The document title becomes "<page> · The Index" in the active
 * language and is updated again when the language changes.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly titleKey = signal<string | undefined>(undefined);

  constructor() {
    super();
    effect(() => {
      this.language.lang();
      const key = this.titleKey();
      const appName = this.transloco.translate('common.appName');
      this.title.setTitle(key ? `${this.transloco.translate(key)} · ${appName}` : appName);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.titleKey.set(this.buildTitle(snapshot));
  }
}
