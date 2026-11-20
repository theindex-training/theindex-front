import { Router, UrlTree } from '@angular/router';

/** The query parameter of `/login` (and `/account-setup`) that holds the page to go to next. */
export const RETURN_URL_PARAM = 'returnUrl';

/** Pages that never make sense to come back to after signing in. */
const NO_RETURN_PATHS = [
  '/',
  '/login',
  '/register',
  '/account-setup',
  '/unauthorized',
];

/**
 * The in-app address `value` names, or null when it isn't one worth (or safe) going back to:
 * only paths of this app (`/…`, never `//host` or `/\host`, which a browser reads as another
 * site), and never the sign-in pages themselves, so a return can't loop.
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (
    !value ||
    value.length > 2000 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\')
  ) {
    return null;
  }

  const path = value.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return NO_RETURN_PATHS.includes(path) ? null : value;
}

/**
 * `/login`, remembering `returnUrl` (`?returnUrl=…`) when it is a page to come back to once
 * signed in.
 */
export function loginUrlTree(router: Router, returnUrl?: string): UrlTree {
  const target = safeReturnUrl(returnUrl);
  return router.createUrlTree(['/login'], {
    queryParams: target ? { [RETURN_URL_PARAM]: target } : {},
  });
}
