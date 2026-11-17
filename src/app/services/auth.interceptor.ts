import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** The `error` of the API's 403 while the first-login setup isn't done (theindex-api `JwtAuthGuard`). */
export const ACCOUNT_SETUP_REQUIRED = 'ACCOUNT_SETUP_REQUIRED';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const request = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        authService.logout();
        void router.navigate(['/login']);
      }

      // The account hasn't finished its first-login setup (e.g. a token from before it existed,
      // which doesn't say so): the API refuses everything else until it has.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        (error.error as { error?: unknown } | null)?.error ===
          ACCOUNT_SETUP_REQUIRED
      ) {
        void router.navigate(['/account-setup']);
      }

      return throwError(() => error);
    }),
  );
};
