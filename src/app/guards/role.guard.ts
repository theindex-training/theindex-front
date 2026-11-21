import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { loginUrlTree } from '../utils/return-url.util';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state,
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data?.['roles'] as string[] | undefined;

  if (!authService.isAuthenticated()) {
    return loginUrlTree(router, state.url);
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const userRole = authService.getUserRole();

  if (userRole && allowedRoles.includes(userRole)) {
    return true;
  }

  if (userRole === 'TRAINEE') {
    return router.parseUrl('/home');
  }

  return router.parseUrl('/unauthorized');
};
