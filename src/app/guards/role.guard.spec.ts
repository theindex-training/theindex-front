import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { makeToken, signInAs } from '../../testing/jwt';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const run = (roles?: string[]) => {
    const route = { data: roles === undefined ? {} : { roles } } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
    return result instanceof UrlTree ? result.toString() : result;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('sends a signed-out visitor to /login, whatever the route allows', () => {
    expect(run(['ADMIN'])).toBe('/login');
    expect(run()).toBe('/login');
  });

  it('lets any signed-in user through when the route lists no roles', () => {
    signInAs('TRAINEE');
    expect(run()).toBe(true);
    expect(run([])).toBe(true);
  });

  it('lets a user through when their role is listed', () => {
    signInAs('TRAINER');
    expect(run(['ADMIN', 'TRAINER'])).toBe(true);
  });

  it('sends a trainee on a staff route to /my-profile', () => {
    signInAs('TRAINEE');
    expect(run(['ADMIN', 'TRAINER'])).toBe('/my-profile');
  });

  it('sends a trainer on an admin-only route to /unauthorized', () => {
    signInAs('TRAINER');
    expect(run(['ADMIN'])).toBe('/unauthorized');
  });

  it('sends staff on a trainee-only route to /unauthorized', () => {
    signInAs('ADMIN');
    expect(run(['TRAINEE'])).toBe('/unauthorized');
  });

  it('sends a token without a role (or an undecodable one) to /unauthorized', () => {
    localStorage.setItem('accessToken', makeToken({ sub: 'a1' }));
    expect(run(['ADMIN'])).toBe('/unauthorized');

    localStorage.setItem('accessToken', 'garbage');
    expect(run(['ADMIN'])).toBe('/unauthorized');
  });
});
