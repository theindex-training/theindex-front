import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { makeToken } from '../../../testing/jwt';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function type(id: string, value: string) {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  async function settle() {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function logInWith(claims: Record<string, unknown>) {
    await type('email', 'coach@gym.test');
    await type('password', 'secret-pass');
    await submit();
    http
      .expectOne('/api/auth/login')
      .flush({ accessToken: makeToken(claims), account: {} });
    await settle();
  }

  const text = () => el.textContent ?? '';

  it('sends nothing and shows both field errors when submitted empty', async () => {
    await submit();

    http.expectNone('/api/auth/login');
    expect(text()).toContain(en.auth.login.emailRequired);
    expect(text()).toContain(en.auth.login.passwordRequired);
  });

  it('requires a password of at least 3 characters', async () => {
    await type('email', 'coach@gym.test');
    await type('password', 'ab');
    await submit();

    http.expectNone('/api/auth/login');
    expect(text()).toContain(en.auth.login.passwordLength);
  });

  it('posts the email (case kept, spaces stripped by the email input) and the password as typed', async () => {
    await type('email', ' Coach@Gym.test ');
    await type('password', 'abc');
    await submit();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    // The component doesn't trim; <input type="email"> sanitizes its value, as browsers do.
    expect(req.request.body).toEqual({
      email: 'Coach@Gym.test',
      password: 'abc',
    });
    req.flush({ accessToken: makeToken({ role: 'ADMIN' }), account: {} });
  });

  it('skips the password check and goes home when the token has no account id', async () => {
    await logInWith({ role: 'TRAINER' });

    http.expectNone((req) => req.url.includes('password-status'));
    expect(router.url).toBe('/home');
  });

  it('sends a trainee without an account id to /my-profile', async () => {
    await logInWith({ role: 'TRAINEE' });

    expect(router.url).toBe('/my-profile');
  });

  it.each([
    ['ADMIN', true, '/home'],
    ['TRAINER', true, '/home'],
    ['TRAINEE', true, '/my-profile'],
    ['ADMIN', false, '/change-password'],
    ['TRAINEE', false, '/change-password'],
  ])(
    '%s with password changed = %s lands on %s',
    async (role, changed, url) => {
      await logInWith({ sub: 'account-1', role });

      const req = http.expectOne('/api/accounts/account-1/password-status');
      expect(req.request.method).toBe('GET');
      req.flush({ accountId: 'account-1', hasUpdatedInitialPassword: changed });
      await settle();

      expect(router.url).toBe(url);
    },
  );

  it('goes to the default page when the password check fails', async () => {
    await logInWith({ sub: 'account-1', role: 'TRAINEE' });

    http
      .expectOne('/api/accounts/account-1/password-status')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(router.url).toBe('/my-profile');
  });

  describe('when the login fails', () => {
    async function failWith(body: object | null) {
      await type('email', 'coach@gym.test');
      await type('password', 'wrong-pass');
      await submit();
      http
        .expectOne('/api/auth/login')
        .flush(body, { status: 401, statusText: 'Unauthorized' });
      await settle();
    }

    const alert = () => el.querySelector('[role="alert"]')?.textContent?.trim();

    it('shows the API message and stores no token', async () => {
      await failWith({ message: 'Invalid credentials' });

      expect(alert()).toBe('Invalid credentials');
      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(router.url).toBe('/');
    });

    it('joins a list of API messages', async () => {
      await failWith({
        message: ['email must be an email', 'password is too short'],
      });

      expect(alert()).toBe('email must be an email, password is too short');
    });

    it('falls back to a generic message when the API sends none', async () => {
      await failWith(null);

      expect(alert()).toBe(en.auth.login.error);
    });

    it('lets the user try again with a second request', async () => {
      await failWith({ message: 'Invalid credentials' });
      await submit();

      http
        .expectOne('/api/auth/login')
        .flush({ accessToken: makeToken({ role: 'ADMIN' }) });
      await settle();
      expect(router.url).toBe('/home');
      expect(alert()).toBeUndefined();
    });
  });

  it('sends a second login request when submitted twice before the first answers', async () => {
    await type('email', 'coach@gym.test');
    await type('password', 'secret-pass');
    await submit();
    await submit();

    // CHARACTERIZATION: possibly unintended — the submit button is never disabled while signing in
    // (isSubmitting is not used in the template), so a double click logs in twice. TEST_NOTES.md S13.
    const requests = http.match('/api/auth/login');
    expect(requests.length).toBe(2);
    requests.forEach((req) =>
      req.flush({ accessToken: makeToken({ role: 'ADMIN' }) }),
    );
    await settle();
  });
});
