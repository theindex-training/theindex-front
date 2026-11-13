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
 * What the connect form starts from: the chosen profile's own values, and what the person
 * registered where the profile has nothing (everything they registered for a new profile). The
 * admin changes anything before connecting. Trainers have no gym subscription.
 */
export function linkFormValues(
  registration: AccountView['registration'],
  profileType: ProfileType,
  profile: LinkableProfile | null,
): LinkFormValues {
  const pick = (
    own: string | null | undefined,
    registered: string | null | undefined,
  ) => (own?.trim() ? own : (registered ?? null));
  const ownHomeGym =
    profileType === 'trainee' ? profile?.preferredGymId : profile?.primaryGymId;
  return {
    name: pick(profile?.name, registration?.name) ?? '',
    nickname: profile?.nickname ?? '',
    contact: {
      phone: pick(profile?.phone, registration?.phone),
      gymSubscriptionId:
        profileType === 'trainee'
          ? pick(profile?.gymSubscriptionId, registration?.gymSubscription?.id)
          : null,
      homeGymId: pick(ownHomeGym, registration?.preferredGym?.id),
      instagram: pick(profile?.instagram, registration?.instagram),
      facebook: pick(profile?.facebook, registration?.facebook),
      tiktok: pick(profile?.tiktok, registration?.tiktok),
    },
  };
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
