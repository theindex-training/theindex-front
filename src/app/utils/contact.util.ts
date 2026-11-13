import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** The API's phone rule (theindex-api `common/utils/contact.util.ts`): 6 to 15 digits, optional +. */
export const PHONE_PATTERN = /^\s*\+?(?:[\s()\-./]*\d){6,15}[\s()\-./]*$/;
export const PHONE_MAX_LENGTH = 30;
export const SOCIAL_LINK_MAX_LENGTH = 200;

export const SOCIAL_NETWORKS = ['instagram', 'facebook', 'tiktok'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** A phone number as the API accepts it. An empty value passes (pair with Validators.required). */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value as string | null) ?? '';
    if (!value.trim()) {
      return null;
    }
    return PHONE_PATTERN.test(value) && value.length <= PHONE_MAX_LENGTH
      ? null
      : { phone: true };
  };
}

/** An optional text field as the API stores it: trimmed, and null when empty. */
export function optionalText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

const PROFILE_BASE: Record<SocialNetwork, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
};

/**
 * Where a social profile (a handle or a link, as the person typed it) can be opened: the link
 * itself when it is an http(s) link, else the network's page for the handle. Null when there is
 * nothing usable, e.g. a handle with spaces.
 */
export function socialProfileUrl(
  network: SocialNetwork,
  value: string | null | undefined,
): string | null {
  const text = (value ?? '').trim();
  if (!text) {
    return null;
  }
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.href
        : null;
    } catch {
      return null;
    }
  }
  const handle = text.replace(/^@/, '');
  return /^[\w.]+$/.test(handle) ? PROFILE_BASE[network] + handle : null;
}
