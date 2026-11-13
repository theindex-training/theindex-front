import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { NamedOption } from '../../services/registration.service';
import { SOCIAL_NETWORKS, SocialNetwork } from '../../utils/contact.util';
import { ContactForm } from './contact-form';

/**
 * The contact fields of a person's details (see `contact-form.ts`): phone, gym subscription (when
 * shown), home gym and the social profiles, as `.form-row`s for a `.form-grid`. The page loads the
 * options; a stored value that isn't among them (e.g. a gym closed since) stays selectable.
 */
@Component({
  selector: 'app-contact-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe],
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

  readonly networks = SOCIAL_NETWORKS;

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

  /** Whether the stored value is missing from the options (it is then offered as is). */
  missing(value: string, options: NamedOption[]): boolean {
    return !!value && !options.some((option) => option.id === value);
  }
}
