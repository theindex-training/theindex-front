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
import { FieldDifferenceComponent } from '../field-difference/field-difference.component';
import { ContactForm, ContactValues } from './contact-form';

type ContactField = keyof ContactValues;

/**
 * The contact fields of a person's details (see `contact-form.ts`): phone, gym subscription (when
 * shown), home gym and the social profiles, as `.form-row`s for a `.form-grid`. The page loads the
 * options; a stored value that isn't among them (e.g. a gym closed since) stays selectable.
 * `differences` (connecting an account to an existing profile) are the profile's own values: each
 * one shows under its field while the field holds something else, with a button to use it.
 */
@Component({
  selector: 'app-contact-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe, FieldDifferenceComponent],
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
