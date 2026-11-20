import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { loginUrlTree } from '../utils/return-url.util';

/** Signed-out visitors go to the login page, which brings them back here once signed in. */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return loginUrlTree(router, state.url);
};
