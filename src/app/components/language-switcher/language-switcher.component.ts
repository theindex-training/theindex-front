import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService, Language } from '../../services/i18n.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.scss',
})
export class LanguageSwitcherComponent {
  constructor(public readonly i18nService: I18nService) {}

  handleLanguageChange(value: string): void {
    if (value === 'en' || value === 'bg') {
      this.i18nService.setLanguage(value as Language);
    }
  }
}
