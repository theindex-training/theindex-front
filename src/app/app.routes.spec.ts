import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { CanActivateFn, Route, Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../public/i18n/en.json';
import { signInAs } from '../testing/jwt';
import { routes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { loginGuard } from './guards/login.guard';
import { roleGuard } from './guards/role.guard';
import { TranslatedTitleStrategy } from './i18n/translated-title.strategy';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { PlanCreateComponent } from './pages/plans/plan-create.component';

const STAFF = ['ADMIN', 'TRAINER'];
const ADMIN = ['ADMIN'];
const TRAINEE = ['TRAINEE'];

/**
 * Who may open each page inside the app shell. `null` = any signed-in user (no roleGuard).
 * Adding a route without a row here fails the test, so access is always decided deliberately.
 */
const SHELL_ACCESS: Record<string, string[] | null> = {
  home: STAFF,
  'my-profile': TRAINEE,
  stats: TRAINEE,
  records: TRAINEE,
  'change-password': null,
  'plans/new': STAFF,
  'plans/:id/edit': STAFF,
  'plans/:id/delete': STAFF,
  'plans/:id': STAFF,
  plans: STAFF,
  'gyms/new': STAFF,
  'gyms/:id/edit': STAFF,
  'gyms/:id/delete': STAFF,
  'gyms/:id': STAFF,
  gyms: STAFF,
  'gym-subscriptions/new': STAFF,
  'gym-subscriptions/:id/edit': STAFF,
  'gym-subscriptions/:id/delete': STAFF,
  'gym-subscriptions/:id': STAFF,
  'gym-subscriptions': STAFF,
  'trainers/new': ADMIN,
  'trainers/:id/edit': ADMIN,
  'trainers/:id/delete': ADMIN,
  'trainers/:id/account': ADMIN,
  'trainers/:id': ADMIN,
  trainers: ADMIN,
  'training-times/new': STAFF,
  'training-times/:id/edit': STAFF,
  'training-times/:id/delete': STAFF,
  'training-times/:id': STAFF,
  'training-times': STAFF,
  'attendance/new': STAFF,
  attendance: STAFF,
  'settlements/new': ADMIN,
  'settlements/:id': STAFF,
  settlements: STAFF,
  'cash-register': ADMIN,
  'trainees/new': STAFF,
  'trainees/:id/edit': STAFF,
  'trainees/:id/delete': STAFF,
  'trainees/:id/account': STAFF,
  'trainees/:id': STAFF,
  trainees: STAFF
};

const guardsOf = (route: Route) => (route.canActivate ?? []) as CanActivateFn[];
const shell = routes.find(route => route.path === '' && route.children)!;
const shellPages = shell.children!.filter(route => !route.redirectTo);

describe('route table', () => {
  it('guards the app shell with authGuard and the login page with loginGuard', () => {
    expect(guardsOf(shell)).toEqual([authGuard]);
    expect(guardsOf(routes.find(route => route.path === 'login')!)).toEqual([loginGuard]);
  });

  it('leaves the error pages outside the shell and unguarded', () => {
    for (const path of ['unauthorized', '**']) {
      const route = routes.find(entry => entry.path === path)!;
      expect(guardsOf(route)).toEqual([]);
    }
  });

  it('has an access rule for every page in the shell, and nothing more', () => {
    expect(shellPages.map(route => route.path).sort()).toEqual(Object.keys(SHELL_ACCESS).sort());
  });

  it.each(Object.entries(SHELL_ACCESS))('%s is open to %j', (path, roles) => {
    const route = shellPages.find(entry => entry.path === path)!;

    if (roles === null) {
      expect(guardsOf(route)).toEqual([]);
      expect(route.data?.['roles']).toBeUndefined();
    } else {
      expect(guardsOf(route)).toEqual([roleGuard]);
      expect(route.data?.['roles']).toEqual(roles);
    }
  });

  it('gives every page a title key that exists in the language files', () => {
    const titled = [...routes, ...shellPages].filter(route => route.title);
    const lookup = (key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);

    for (const route of titled) {
      expect(typeof lookup(route.title as string), `${route.path} → ${String(route.title)}`).toBe('string');
    }
  });
});

describe('routing (real routes)', () => {
  let harness: RouterTestingHarness | undefined;
  let router: Router;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy }
      ]
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    // Pages fire their own data requests; this suite only checks where navigation lands.
    TestBed.inject(HttpTestingController).match(() => true);
  });

  async function open(url: string) {
    harness ??= await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return router.url;
  }

  /** The page component rendered inside the shell (the deepest activated route). */
  function leafComponent() {
    let route = router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.component;
  }

  it('sends a signed-out visitor at / to /login', async () => {
    expect(await open('/')).toBe('/login');
  });

  it('sends a signed-out deep link into the shell to /login', async () => {
    expect(await open('/trainees')).toBe('/login');
  });

  it('sends signed-in staff at / to /home and a trainee to /my-profile', async () => {
    signInAs('ADMIN');
    expect(await open('/')).toBe('/home');

    signInAs('TRAINEE');
    expect(await open('/')).toBe('/my-profile');
  });

  it('keeps a trainee out of staff pages and a trainer out of admin pages', async () => {
    signInAs('TRAINEE');
    expect(await open('/trainees')).toBe('/my-profile');

    signInAs('TRAINER');
    expect(await open('/trainers')).toBe('/unauthorized');
    expect(await open('/cash-register')).toBe('/unauthorized');
    expect(await open('/settlements/new')).toBe('/unauthorized');
    expect(await open('/settlements')).toBe('/settlements');
  });

  it('lets every role open Change password', async () => {
    for (const role of ['ADMIN', 'TRAINER', 'TRAINEE'] as const) {
      signInAs(role);
      expect(await open('/change-password')).toBe('/change-password');
    }
  });

  it('opens the create page for /plans/new, not the details of a plan called "new"', async () => {
    signInAs('ADMIN');
    await open('/plans/new');

    expect(leafComponent()).toBe(PlanCreateComponent);
  });

  it('shows the not-found page for an unknown URL, signed in or not', async () => {
    await open('/no-such-page');
    expect(leafComponent()).toBe(NotFoundComponent);

    signInAs('ADMIN');
    await open('/trainees/1/nope');
    expect(leafComponent()).toBe(NotFoundComponent);
  });

  it('sets the document title to "<page> · The Index"', async () => {
    signInAs('ADMIN');
    await open('/plans/new');

    expect(TestBed.inject(Title).getTitle()).toBe(`${en.plans.create.title} · ${en.common.appName}`);
  });
});
