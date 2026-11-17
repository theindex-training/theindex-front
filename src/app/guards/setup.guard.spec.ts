import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { signInAs } from '../../testing/jwt';
import { setupGuard } from './setup.guard';

describe('setupGuard', () => {
  const run = () =>
    TestBed.runInInjectionContext(() =>
      setupGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it.each(['TRAINEE', 'TRAINER'] as const)(
    'sends a %s whose token requires the first-login setup to /account-setup',
    (role) => {
      signInAs(role, { setupRequired: true });
      const result = run();
      expect(result instanceof UrlTree && result.toString()).toBe(
        '/account-setup',
      );
    },
  );

  it('lets a set-up account through', () => {
    signInAs('TRAINEE', { setupRequired: false });
    expect(run()).toBe(true);
  });

  it('lets a token without the claim through (the API still refuses until set up)', () => {
    signInAs('TRAINER');
    expect(run()).toBe(true);
  });
});
