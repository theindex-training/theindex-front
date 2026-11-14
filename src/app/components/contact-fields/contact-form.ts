import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  optionalText,
  phoneValidator,
  SOCIAL_LINK_MAX_LENGTH,
} from '../../utils/contact.util';

/**
 * The contact part of a person's details, shared by Register, My details and connecting an account:
 * phone, gym subscription (trainees), home gym and social profiles. Selects use '' for none.
 */
export type ContactForm = FormGroup<{
  phone: FormControl<string>;
  gymSubscriptionId: FormControl<string>;
  homeGymId: FormControl<string>;
  instagram: FormControl<string>;
  facebook: FormControl<string>;
  tiktok: FormControl<string>;
}>;

/** The values as the API takes them: trimmed, empty as null. */
export interface ContactValues {
  phone: string | null;
  gymSubscriptionId: string | null;
  homeGymId: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
}

export function contactForm(opts: { phoneRequired: boolean }): ContactForm {
  const text = (validators = [Validators.maxLength(SOCIAL_LINK_MAX_LENGTH)]) =>
    new FormControl('', { nonNullable: true, validators });
  return new FormGroup({
    phone: new FormControl('', {
      nonNullable: true,
      validators: opts.phoneRequired
        ? [Validators.required, phoneValidator()]
        : [phoneValidator()],
    }),
    gymSubscriptionId: text([]),
    homeGymId: text([]),
    instagram: text(),
    facebook: text(),
    tiktok: text(),
  });
}

export function contactValues(form: ContactForm): ContactValues {
  const raw = form.getRawValue();
  return {
    phone: optionalText(raw.phone),
    gymSubscriptionId: raw.gymSubscriptionId || null,
    homeGymId: raw.homeGymId || null,
    instagram: optionalText(raw.instagram),
    facebook: optionalText(raw.facebook),
    tiktok: optionalText(raw.tiktok),
  };
}

export function fillContactForm(
  form: ContactForm,
  values: Partial<ContactValues>,
): void {
  form.setValue({
    phone: values.phone ?? '',
    gymSubscriptionId: values.gymSubscriptionId ?? '',
    homeGymId: values.homeGymId ?? '',
    instagram: values.instagram ?? '',
    facebook: values.facebook ?? '',
    tiktok: values.tiktok ?? '',
  });
}
