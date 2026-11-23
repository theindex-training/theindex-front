import { SOCIAL_NETWORKS, SocialNetwork } from './contact.util';

/**
 * Checks and tidies a social profile as a person types it: a handle ("@name", "name") or a link.
 * Only the format is checked (each network's username rules, and that a link goes to that network's
 * profile page); whether the profile exists can't be known from here. Nothing here blocks a save:
 * the form shows a warning and the "Open" link lets the person check it themselves.
 */

/** Why a value doesn't look like a profile on its network. */
export type SocialWarning =
  /** Not a handle the network allows (characters, length). */
  | 'handle'
  /** A link to another of the networks, e.g. an Instagram link in the Facebook field. */
  | 'otherNetwork'
  /** A link to the network, but not to a profile (a post, a reel, a group, the home page...). */
  | 'notProfile'
  /** A link to some other site. */
  | 'otherSite';

export interface SocialCheck {
  /** Where the profile opens, while the value looks right; null otherwise. */
  url: string | null;
  /** What looks wrong; null when it looks right (or is empty). */
  warning: SocialWarning | null;
  /** The network a link goes to, for `otherNetwork`. */
  linkedNetwork: SocialNetwork | null;
}

const HOSTS: Record<SocialNetwork, readonly string[]> = {
  instagram: ['instagram.com', 'instagr.am'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  tiktok: ['tiktok.com'],
};

// Instagram: up to 30 letters, digits, periods and underscores; no period first, last or twice in a row.
const INSTAGRAM_HANDLE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/i;
// TikTok: 2 to 24 letters, digits, periods and underscores, not ending with a period.
const TIKTOK_HANDLE = /^(?!.*\.$)[a-z0-9._]{2,24}$/i;
// Facebook: a username of at least 5 letters, digits and periods (no underscores).
const FACEBOOK_HANDLE = /^[a-z0-9.]{5,50}$/i;

const HANDLE: Record<SocialNetwork, RegExp> = {
  instagram: INSTAGRAM_HANDLE,
  facebook: FACEBOOK_HANDLE,
  tiktok: TIKTOK_HANDLE,
};

// First path segments that are the networks' own pages, not someone's profile.
const RESERVED: Record<SocialNetwork, ReadonlySet<string>> = {
  instagram: new Set([
    'p',
    'reel',
    'reels',
    'stories',
    'explore',
    'accounts',
    'tv',
    'direct',
    'about',
    'legal',
  ]),
  facebook: new Set([
    'groups',
    'events',
    'watch',
    'photo',
    'photo.php',
    'photos',
    'story.php',
    'permalink.php',
    'posts',
    'marketplace',
    'reel',
    'login',
    'login.php',
    'home.php',
    'sharer',
    'sharer.php',
    'help',
    'hashtag',
  ]),
  tiktok: new Set(),
};

const PROFILE_BASE: Record<SocialNetwork, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/@',
};

type Parsed =
  | { kind: 'empty' }
  | { kind: 'handle'; handle: string }
  | { kind: 'badHandle' }
  | { kind: 'profile'; network: SocialNetwork; handle: string }
  /** A profile link that has no handle in it (Facebook ids, share and short links): kept as is. */
  | { kind: 'profileLink'; network: SocialNetwork; url: string; tidy: string }
  | { kind: 'notProfile'; network: SocialNetwork }
  | { kind: 'otherSite' };

/** What the value is, read for `network` (handles are checked against its rules). */
function parse(
  network: SocialNetwork,
  value: string | null | undefined,
): Parsed {
  const text = (value ?? '').trim();
  if (!text) {
    return { kind: 'empty' };
  }
  const url = asUrl(text);
  if (!url) {
    const handle = text.replace(/^@/, '');
    return HANDLE[network].test(handle)
      ? { kind: 'handle', handle }
      : { kind: 'badHandle' };
  }
  const linked = networkOf(url.hostname);
  if (!linked) {
    return { kind: 'otherSite' };
  }
  return parseLink(linked, url);
}

/** The value as a URL when it is a link: http(s), or a bare address such as "instagram.com/name". */
function asUrl(text: string): URL | null {
  let candidate: string;
  if (/^https?:\/\//i.test(text)) {
    candidate = text;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    // Another scheme (javascript:, mailto:...) is no profile; read it as a (bad) handle.
    return null;
  } else if (
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]|$)/i.test(text) &&
    looksLikeHost(text)
  ) {
    candidate = `https://${text}`;
  } else {
    return null;
  }
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

/**
 * Whether a bare value starts with an address rather than being a handle with periods
 * ("ivan.petrov" is a handle; "instagram.com/ivan", "www.example.org" and "fb.me/x" are links).
 */
function looksLikeHost(text: string): boolean {
  const host = text.split(/[/?#]/, 1)[0].toLowerCase();
  return (
    text.length > host.length ||
    host.startsWith('www.') ||
    networkOf(host) !== null
  );
}

function networkOf(hostname: string): SocialNetwork | null {
  const host = hostname.toLowerCase();
  return (
    SOCIAL_NETWORKS.find((network) =>
      HOSTS[network].some((base) => host === base || host.endsWith(`.${base}`)),
    ) ?? null
  );
}

function parseLink(network: SocialNetwork, url: URL): Parsed {
  const segments = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.toLowerCase();
  const first = segments[0] ?? '';
  const keep = (): Parsed => {
    const tidy = `https://${host}${url.pathname}`;
    return { kind: 'profileLink', network, url: tidy, tidy };
  };

  if (network === 'tiktok') {
    // vm.tiktok.com/XYZ and tiktok.com/t/XYZ are the app's short links (to a profile or a video).
    if (/^v[mt]\./.test(host) || first === 't') {
      return segments.length ? keep() : { kind: 'notProfile', network };
    }
    if (segments.length === 1 && first.startsWith('@')) {
      const handle = decode(first.slice(1));
      if (TIKTOK_HANDLE.test(handle)) {
        return { kind: 'profile', network, handle };
      }
    }
    return { kind: 'notProfile', network };
  }

  if (network === 'facebook') {
    if (host === 'fb.me' || host.endsWith('.fb.me')) {
      return segments.length ? keep() : { kind: 'notProfile', network };
    }
    if (first === 'profile.php') {
      const id = url.searchParams.get('id');
      if (id && /^\d+$/.test(id)) {
        const link = `https://www.facebook.com/profile.php?id=${id}`;
        return { kind: 'profileLink', network, url: link, tidy: link };
      }
      return { kind: 'notProfile', network };
    }
    // The app's "Copy link" (share/...) and newer profiles (people/<name>/<id>).
    if ((first === 'share' || first === 'people') && segments.length > 1) {
      return keep();
    }
  }

  if (segments.length === 1 && !RESERVED[network].has(first.toLowerCase())) {
    const handle = decode(first.replace(/^@/, ''));
    if (HANDLE[network].test(handle)) {
      return { kind: 'profile', network, handle };
    }
  }
  return { kind: 'notProfile', network };
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** How the value looks for `network`: where it opens, or what looks wrong. */
export function checkSocialProfile(
  network: SocialNetwork,
  value: string | null | undefined,
): SocialCheck {
  const parsed = parse(network, value);
  const result = (
    url: string | null,
    warning: SocialWarning | null,
    linkedNetwork: SocialNetwork | null = null,
  ): SocialCheck => ({ url, warning, linkedNetwork });

  switch (parsed.kind) {
    case 'empty':
      return result(null, null);
    case 'handle':
      return result(PROFILE_BASE[network] + parsed.handle, null);
    case 'badHandle':
      return result(null, 'handle');
    case 'otherSite':
      return result(null, 'otherSite');
    case 'notProfile':
      return parsed.network === network
        ? result(null, 'notProfile')
        : result(null, 'otherNetwork', parsed.network);
    case 'profile':
      return parsed.network === network
        ? result(PROFILE_BASE[network] + parsed.handle, null)
        : result(null, 'otherNetwork', parsed.network);
    case 'profileLink':
      return parsed.network === network
        ? result(parsed.url, null)
        : result(null, 'otherNetwork', parsed.network);
  }
}

/**
 * The value as it is stored: a profile link of the network becomes its handle ("@name"), a bare
 * handle gets its "@", a Facebook id link loses its tracking parameters, a short or share link loses
 * its query. Anything that doesn't look right is only trimmed, so nothing typed is lost.
 */
export function normalizeSocialProfile(
  network: SocialNetwork,
  value: string | null | undefined,
): string {
  const text = (value ?? '').trim();
  const parsed = parse(network, text);
  switch (parsed.kind) {
    case 'handle':
      return `@${parsed.handle}`;
    case 'profile':
      return parsed.network === network ? `@${parsed.handle}` : text;
    case 'profileLink':
      return parsed.network === network ? parsed.tidy : text;
    default:
      return text;
  }
}

/** A profile link as it reads under the field: no scheme, no "www.", no trailing slash. */
export function displaySocialUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}
