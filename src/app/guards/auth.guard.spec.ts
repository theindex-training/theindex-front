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
  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('sends a signed-out visitor to /login', () => {
    const result = run();
    expect(result instanceof UrlTree && result.toString()).toBe('/login');
  });

  it('lets anyone with a token through', () => {
    signInAs('TRAINEE');
    expect(run()).toBe(true);
  });
});
