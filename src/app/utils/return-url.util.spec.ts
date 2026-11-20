import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { loginUrlTree, safeReturnUrl } from './return-url.util';

describe('safeReturnUrl', () => {
  it('keeps an address of this app, with its query and fragment', () => {
    expect(safeReturnUrl('/trainees/t-1')).toBe('/trainees/t-1');
    expect(safeReturnUrl('/workouts?week=2026-11-16#mon')).toBe(
      '/workouts?week=2026-11-16#mon',
    );
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['trainees'],
    ['https://evil.example/trainees'],
    ['//evil.example/trainees'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    [`/${'a'.repeat(2000)}`],
  ])('refuses %j, which is not an address of this app', (value) => {
    expect(safeReturnUrl(value)).toBeNull();
  });

  it.each([
    '/',
    '/login',
    '/login/',
    '/login?returnUrl=%2Ftrainees',
    '/register',
    '/account-setup',
    '/unauthorized',
  ])('refuses %s, which is part of signing in', (value) => {
    expect(safeReturnUrl(value)).toBeNull();
  });
});

describe('loginUrlTree', () => {
  const tree = (url?: string) =>
    loginUrlTree(TestBed.inject(Router), url).toString();

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('remembers the page to come back to', () => {
    expect(tree('/schedule/s-1?week=2026-11-16')).toBe(
      '/login?returnUrl=%2Fschedule%2Fs-1%3Fweek%3D2026-11-16',
    );
  });

  it('is the plain login page without one worth coming back to', () => {
    expect(tree()).toBe('/login');
    expect(tree('/login?returnUrl=%2Ftrainees')).toBe('/login');
    expect(tree('//evil.example')).toBe('/login');
  });
});
