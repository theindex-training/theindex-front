import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import { NamedOption } from '../../services/registration.service';
import { SOCIAL_NETWORKS, SocialNetwork } from '../../utils/contact.util';
import {
  checkSocialProfile,
  displaySocialUrl,
  normalizeSocialProfile,
  SocialCheck,
} from '../../utils/social-profile.util';
import { FieldDifferenceComponent } from '../field-difference/field-difference.component';
import { IconComponent } from '../icon/icon.component';
import { SocialIconComponent } from '../social-icon/social-icon.component';
import { ContactForm, ContactValues } from './contact-form';

type ContactField = keyof ContactValues;

/**
 * The contact fields of a person's details (see `contact-form.ts`): phone, gym subscription (when
 * shown), home gym and the social profiles, as `.form-row`s for a `.form-grid`. The page loads the
 * options; a stored value that isn't among them (e.g. a gym closed since) stays selectable.
 * `differences` (connecting an account to an existing profile) are the profile's own values: each
 * one shows under its field while the field holds something else, with a button to use it.
 * Social profiles get their network's logo, a warning when the value doesn't look like a profile
 * there (never an error: it still saves) and, when it does, the address with an "Open" link so the
 * person can check it. A profile link is tidied to "@handle" when the field loses focus.
 */
@Component({
  selector: 'app-contact-fields',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    FieldDifferenceComponent,
    IconComponent,
    SocialIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './contact-fields.component.html',
  styleUrl: './contact-fields.component.scss',
  // Rows of the parent's .form-grid.
  host: { style: 'display: contents' },
})
export class ContactFieldsComponent {
  @Input({ required: true }) form!: ContactForm;
  /** Prefix of the field ids, unique on the page. */
  @Input({ required: true }) idPrefix = '';
  @Input() gyms: NamedOption[] = [];
  @Input() gymSubscriptions: NamedOption[] = [];
  @Input() showGymSubscription = true;
  /** Which home gym it is: a trainee's preferred gym or a trainer's primary gym. */
  @Input() homeGym: 'preferred' | 'primary' = 'preferred';
  @Input() phoneRequired = true;
  /** Per field, the existing profile's value where it differs from what the person registered. */
  @Input() differences: Partial<Record<ContactField, string>> = {};

  readonly networks = SOCIAL_NETWORKS;
  private readonly i18n = inject(LanguageService);

  id(field: string): string {
    return `${this.idPrefix}-${field}`;
  }

  invalid(field: 'phone' | SocialNetwork): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  /** How a social profile looks: where it opens, or what looks wrong. */
  social(network: SocialNetwork): SocialCheck {
    return checkSocialProfile(network, this.form.controls[network].value);
  }

  /**
   * The warning to show, as a key and its params, or null. A link is complete once pasted, so its
   * warning shows at once; a handle waits until the field is left, so a half-typed one isn't
   * flagged. A stored value (not changed yet) shows it straight away.
   */
  socialWarning(
    network: SocialNetwork,
  ): { key: string; params: Record<string, string> } | null {
    const { warning, linkedNetwork } = this.social(network);
    const control = this.form.controls[network];
    if (
      !warning ||
      (warning === 'handle' && control.dirty && !control.touched)
    ) {
      return null;
    }
    const name = (n: SocialNetwork) => this.i18n.t(`contact.networks.${n}`);
    return warning === 'handle'
      ? { key: `contact.socialWarnings.handle.${network}`, params: {} }
      : {
          key: `contact.socialWarnings.${warning}`,
          params: {
            network: name(network),
            linked: linkedNetwork ? name(linkedNetwork) : '',
          },
        };
  }

  socialAddress(url: string): string {
    return displaySocialUrl(url);
  }

  networkName(network: SocialNetwork): string {
    return this.i18n.t(`contact.networks.${network}`);
  }

  /** On blur: a profile link becomes "@handle", a bare handle gets its "@" (see the util). */
  tidySocial(network: SocialNetwork): void {
    const control = this.form.controls[network];
    const tidy = normalizeSocialProfile(network, control.value);
    if (tidy !== control.value.trim()) {
      control.setValue(tidy);
      control.markAsDirty();
    }
  }

  get phoneError(): string {
    return this.form.controls.phone.hasError('required')
      ? 'contact.phoneRequired'
      : 'contact.phoneError';
  }

  /** The profile's value as shown, while the field holds something else; '' otherwise. */
  difference(field: ContactField): string {
    const value = this.differences[field];
    if (!value || value.trim() === this.form.controls[field].value.trim()) {
      return '';
    }
    const options =
      field === 'homeGymId'
        ? this.gyms
        : field === 'gymSubscriptionId'
          ? this.gymSubscriptions
          : null;
    if (!options) {
      return value;
    }
    return (
      options.find((option) => option.id === value)?.name ??
      this.i18n.t('contact.unavailable')
    );
  }

  useDifference(field: ContactField): void {
    const control = this.form.controls[field];
    control.setValue(this.differences[field] ?? '');
    control.markAsDirty();
  }

  /** The field's aria-describedby: its hint or error, plus the difference while shown. */
  describedBy(field: ContactField, base: string): string {
    return this.difference(field)
      ? `${base}-help ${base}-diff`
      : `${base}-help`;
  }

  /** Whether the stored value is missing from the options (it is then offered as is). */
  missing(value: string, options: NamedOption[]): boolean {
    return !!value && !options.some((option) => option.id === value);
  }
}
