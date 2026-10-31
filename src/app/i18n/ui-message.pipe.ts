import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';
import { UiMessage } from './ui-message';

/** Renders a UiMessage: translates keys in the active language, passes API text through. */
@Pipe({ name: 'uiMessage', standalone: true, pure: false })
export class UiMessagePipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  transform(message: UiMessage | null | undefined): string {
    if (!message) {
      return '';
    }
    if ('text' in message) {
      return message.text;
    }
    // Reading the signal re-renders the view on a language switch.
    this.language.lang();
    return this.transloco.translate(message.key, message.params);
  }
}
