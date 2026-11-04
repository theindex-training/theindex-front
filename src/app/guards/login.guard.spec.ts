import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { makeToken, signInAs } from '../../testing/jwt';
import { loginGuard } from './login.guard';

describe('loginGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() =>
      loginGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  const redirect = () => {
    const result = run();
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
