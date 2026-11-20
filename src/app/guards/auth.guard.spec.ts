import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { signInAs } from '../../testing/jwt';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const run = (url = '/trainees') =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const redirect = (url?: string) => {
    const result = run(url);
    return result instanceof UrlTree ? result.toString() : result;
  };

  it('sends a signed-out visitor to /login, to come back to the page once signed in', () => {
    expect(redirect('/trainees/t-1?tab=history')).toBe(
      '/login?returnUrl=%2Ftrainees%2Ft-1%3Ftab%3Dhistory',
    );
  });

  it('remembers no page that is part of signing in', () => {
    expect(redirect('/account-setup')).toBe('/login');
  });

  it('lets anyone with a token through', () => {
    signInAs('TRAINEE');
    expect(run()).toBe(true);
  });
});
