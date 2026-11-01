import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { EnumGroup, enumLabelKey } from './enum-labels';
import { LanguageService } from './language.service';

/**
 * Translates an API enum value, e.g. `{{ plan.type | enumLabel: 'planType' }}`. An unknown value
 * (the API added one the UI doesn't know yet) is shown as is rather than as a raw key.
 */
@Pipe({ name: 'enumLabel', standalone: true, pure: false })
export class EnumLabelPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);

  transform(value: string | null | undefined, group: EnumGroup): string {
    if (!value) {
      return '';
    }
    const lang = this.language.lang();
    const key = enumLabelKey(group, value);
    const known = this.transloco.getTranslation(lang)[key] !== undefined;
    return known ? this.transloco.translate(key) : value;
  }
}
