import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Keeps an account that hasn't finished its first-login setup on `/account-setup` (the token's
 * `setupRequired` claim). On the shell as `canActivate` and `canActivateChild`, so every page of
 * the app, reached any way, sends it there. The API refuses those pages' requests anyway.
 */
export const setupGuard: CanActivateFn & CanActivateChildFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isSetupRequired()
    ? router.parseUrl('/account-setup')
    : true;
};
