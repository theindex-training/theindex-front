import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RETURN_URL_PARAM, safeReturnUrl } from '../utils/return-url.util';

/**
 * Keeps signed-in people off the login and register pages: they go where the login would have
 * taken them (`?returnUrl=`, e.g. after signing in in another tab), else to their start page.
 */
export const loginGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  const returnUrl = safeReturnUrl(route.queryParamMap.get(RETURN_URL_PARAM));
  if (returnUrl) {
    return router.parseUrl(returnUrl);
  }

  return router.parseUrl(authService.defaultRoute());
};
