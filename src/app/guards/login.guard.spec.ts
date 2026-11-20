import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { makeToken, signInAs } from '../../testing/jwt';
import { loginGuard } from './login.guard';

describe('loginGuard', () => {
  const run = (queryParams: Record<string, string> = {}) =>
    TestBed.runInInjectionContext(() =>
      loginGuard(
        {
          queryParamMap: convertToParamMap(queryParams),
        } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
  const redirect = (queryParams?: Record<string, string>) => {
    const result = run(queryParams);
    return result instanceof UrlTree ? result.toString() : result;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('shows the login page to signed-out visitors', () => {
    expect(run()).toBe(true);
  });

  it('sends a signed-in trainee to /my-profile', () => {
    signInAs('TRAINEE');
    expect(redirect()).toBe('/my-profile');
  });

  it.each(['ADMIN', 'TRAINER'] as const)(
    'sends a signed-in %s to /home',
    (role) => {
      signInAs(role);
      expect(redirect()).toBe('/home');
    },
  );

  it('sends a signed-in user to the page the login was going to return to', () => {
    signInAs('TRAINEE');
    expect(redirect({ returnUrl: '/schedule/s-1?week=2026-11-16' })).toBe(
      '/schedule/s-1?week=2026-11-16',
    );
  });

  it('ignores a return address outside the app, or one of the sign-in pages', () => {
    signInAs('ADMIN');
    expect(redirect({ returnUrl: '//evil.example/home' })).toBe('/home');
    expect(redirect({ returnUrl: 'https://evil.example' })).toBe('/home');
    expect(redirect({ returnUrl: '/login' })).toBe('/home');
  });

  it('shows the login page to a signed-out visitor with a return address', () => {
    expect(run({ returnUrl: '/trainees' })).toBe(true);
  });

  it('sends an unknown role or an undecodable token to /home', () => {
    localStorage.setItem(
      'accessToken',
      makeToken({ sub: 'a1', role: 'OWNER' }),
    );
    expect(redirect()).toBe('/home');

    localStorage.setItem('accessToken', 'garbage');
    expect(redirect()).toBe('/home');
  });
});
