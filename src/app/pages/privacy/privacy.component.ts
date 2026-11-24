import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BrandComponent } from '../../components/brand/brand.component';
import { LanguageSwitchComponent } from '../../components/language-switch/language-switch.component';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { AuthService } from '../../services/auth.service';
import { PRIVACY_POLICY_UPDATED } from '../../utils/privacy-policy';

/**
 * The privacy policy (GDPR, Art. 13): public, outside the shell, for anyone signed in or not. Its
 * text is `privacy.*` in both language files; the date it last changed is `PRIVACY_POLICY_UPDATED`.
 */
@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, BrandComponent, LanguageSwitchComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  private readonly format = inject(LocaleFormatService);
  /** Signed in: back to the app; else back to the sign-in page. */
  readonly signedIn = inject(AuthService).isAuthenticated();

  updated(): string {
    return this.format.date(PRIVACY_POLICY_UPDATED);
  }
}
