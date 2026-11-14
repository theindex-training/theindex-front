import { ContactValues } from '../../components/contact-fields/contact-form';
import {
  AccountView,
  LinkAccountPayload,
  ProfileType,
} from '../../services/accounts.service';
import { optionalText } from '../../utils/contact.util';

/** The name to show for an account: what they registered, else the profile's, else the email. */
export function accountName(account: AccountView): string {
  return (
    account.registration?.name ??
    account.profile?.name ??
    account.email ??
    account.id
  );
}

/** The phone to show: the registered one (profiles keep their own). */
export function accountPhone(account: AccountView): string | null {
  return account.registration?.phone ?? null;
}

/** Client-side search over the email, the registered name and phone, and the profile name. */
export function matchesAccount(account: AccountView, term: string): boolean {
  const query = term.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [
    account.email,
    account.registration?.name,
    account.registration?.phone,
    account.profile?.name,
  ].some((value) => !!value && value.toLowerCase().includes(query));
}

export interface ProfileCandidate {
  id: string;
  name: string;
  nickname: string | null;
  phone?: string | null;
}

/** The last 9 digits of a phone, so "+359 88 123 4567" and "0881234567" compare equal. */
function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(-9) : null;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s.,'"-]+/)
    .filter((word) => word.length >= 2);
}

/**
 * The profiles that look like the person who registered: the same phone number, or a name sharing
 * a word with the registered name (or the nickname matching one), best first. The rest keep the
 * order they came in.
 */
export function suggestProfiles<T extends ProfileCandidate>(
  registration: AccountView['registration'],
  profiles: T[],
): { suggested: T[]; others: T[] } {
  if (!registration) {
    return { suggested: [], others: profiles };
  }
  const phone = phoneKey(registration.phone);
  const nameWords = new Set(words(registration.name));
  const score = (profile: T): number => {
    let total = 0;
    if (phone && phoneKey(profile.phone) === phone) {
      total += 2;
    }
    const profileWords = [
      ...words(profile.name),
      ...words(profile.nickname ?? ''),
    ];
    if (profileWords.some((word) => nameWords.has(word))) {
      total += 1;
    }
    return total;
  };

  const scored = profiles.map((profile) => ({
    profile,
    score: score(profile),
  }));
  return {
    suggested: scored
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.profile),
    others: scored
      .filter((entry) => entry.score === 0)
      .map((entry) => entry.profile),
  };
}

/** A trainee or trainer profile as the connect form reads it. */
export interface LinkableProfile extends ProfileCandidate {
  gymSubscriptionId?: string | null;
  preferredGymId?: string | null;
  primaryGymId?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
}

export interface LinkFormValues {
  name: string;
  nickname: string;
  contact: ContactValues;
}

/**
 * What the connect form starts from: what the person registered, and the chosen profile's own
 * values where they registered nothing (most profiles exist before their account). Where both have
 * a value and they differ, `profileDifferences` says so, so the admin sees both. The nickname is
 * the profile's: people never give one. Trainers have no gym subscription.
 */
export function linkFormValues(
  registration: AccountView['registration'],
  profileType: ProfileType,
  profile: LinkableProfile | null,
): LinkFormValues {
  const own = profileFields(profileType, profile);
  const registered = registeredFields(profileType, registration);
  const pick = (field: LinkField) =>
    hasValue(registered[field]) ? registered[field] : own[field];
  return {
    name: pick('name') ?? '',
    nickname: profile?.nickname ?? '',
    contact: {
      phone: pick('phone'),
      gymSubscriptionId: pick('gymSubscriptionId'),
      homeGymId: pick('homeGymId'),
      instagram: pick('instagram'),
      facebook: pick('facebook'),
      tiktok: pick('tiktok'),
    },
  };
}

/** The connect form's fields that both a registration and a profile can hold. */
export type LinkField = 'name' | keyof ContactValues;

/** Per field, the profile's own value where it differs from what the person registered. */
export type LinkDifferences = Partial<Record<LinkField, string>>;

/**
 * Where the chosen profile already stores something other than what the person registered: the
 * profile's value per field. Only fields where both have a value; spelling that doesn't change the
 * value (case and spaces in a name, phone separators, "@" before a handle) doesn't count.
 */
export function profileDifferences(
  registration: AccountView['registration'],
  profileType: ProfileType,
  profile: LinkableProfile | null,
): LinkDifferences {
  if (!registration || !profile) {
    return {};
  }
  const own = profileFields(profileType, profile);
  const registered = registeredFields(profileType, registration);
  const differences: LinkDifferences = {};
  for (const field of Object.keys(own) as LinkField[]) {
    const ownValue = own[field];
    const registeredValue = registered[field];
    if (
      hasValue(ownValue) &&
      hasValue(registeredValue) &&
      comparable(field, ownValue) !== comparable(field, registeredValue)
    ) {
      differences[field] = ownValue;
    }
  }
  return differences;
}

/** Whether two values of a field are the same, as `profileDifferences` compares them. */
export function sameLinkValue(
  field: LinkField,
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return comparable(field, a ?? '') === comparable(field, b ?? '');
}

type FieldValues = Record<LinkField, string | null>;

function profileFields(
  profileType: ProfileType,
  profile: LinkableProfile | null,
): FieldValues {
  return {
    name: profile?.name ?? null,
    phone: profile?.phone ?? null,
    gymSubscriptionId:
      profileType === 'trainee' ? (profile?.gymSubscriptionId ?? null) : null,
    homeGymId:
      (profileType === 'trainee'
        ? profile?.preferredGymId
        : profile?.primaryGymId) ?? null,
    instagram: profile?.instagram ?? null,
    facebook: profile?.facebook ?? null,
    tiktok: profile?.tiktok ?? null,
  };
}

function registeredFields(
  profileType: ProfileType,
  registration: AccountView['registration'],
): FieldValues {
  return {
    name: registration?.name ?? null,
    phone: registration?.phone ?? null,
    gymSubscriptionId:
      profileType === 'trainee'
        ? (registration?.gymSubscription?.id ?? null)
        : null,
    homeGymId: registration?.preferredGym?.id ?? null,
    instagram: registration?.instagram ?? null,
    facebook: registration?.facebook ?? null,
    tiktok: registration?.tiktok ?? null,
  };
}

function hasValue(value: string | null | undefined): value is string {
  return !!value?.trim();
}

function comparable(field: LinkField, value: string): string {
  const text = value.trim();
  switch (field) {
    case 'name':
      return text.replace(/\s+/g, ' ').toLowerCase();
    case 'phone':
      return phoneKey(text) ?? text;
    case 'instagram':
    case 'facebook':
    case 'tiktok':
      return text.toLowerCase().replace(/^@/, '').replace(/\/+$/, '');
    default:
      return text;
  }
}

/** The request body: every field, as the admin decided (empty clears it on an existing profile). */
export function linkPayload(
  profileType: ProfileType,
  profileId: string | null,
  values: LinkFormValues,
): LinkAccountPayload {
  const { contact } = values;
  return {
    profileType,
    ...(profileId ? { profileId } : {}),
    name: values.name.trim(),
    nickname: optionalText(values.nickname),
    phone: contact.phone,
    ...(profileType === 'trainee'
      ? { gymSubscriptionId: contact.gymSubscriptionId }
      : {}),
    homeGymId: contact.homeGymId,
    instagram: contact.instagram,
    facebook: contact.facebook,
    tiktok: contact.tiktok,
  };
}
