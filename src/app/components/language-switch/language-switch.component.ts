import { Component, Input, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Language, LanguageService } from '../../i18n/language.service';

let nextId = 0;

/**
 * БГ / EN segmented control for the navigation shell and the login page. Native radios give
 * arrow-key support; each option is named in its own language for screen readers.
 */
@Component({
  selector: 'app-language-switch',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './language-switch.component.html',
  styleUrl: './language-switch.component.scss'
})
export class LanguageSwitchComponent {
  /** Content-width control (login page) instead of the full-width one in the sidebar and sheet. */
  @Input() compact = false;

  readonly language = inject(LanguageService);
  // Sidebar and sheet both render a switch, so each radio group needs its own name.
  readonly name = `language-switch-${nextId++}`;

  readonly options: { value: Language; short: string; name: string }[] = [
    { value: 'bg', short: 'БГ', name: 'Български' },
    { value: 'en', short: 'EN', name: 'English' }
  ];
}
