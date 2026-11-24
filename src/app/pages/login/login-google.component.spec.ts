import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { LanguageService } from '../../i18n/language.service';
import {
  GOOGLE_IDENTITY_SCRIPT,
  GoogleAccountsId,
  GoogleButtonOptions,
  GoogleCredentialResponse,
} from '../../services/google-sign-in.service';
import { ThemeService } from '../../services/theme.service';
import { makeToken } from '../../../testing/jwt';
import { LoginComponent } from './login.component';

type GoogleWindow = Window & {
  google?: { accounts?: { id?: GoogleAccountsId } };
};

/**
 * Stands in for Google Identity Services (a third-party script, the browser boundary): records
 * `initialize` and `renderButton`, draws a plain button, and `signIn()` completes a sign-in as
 * Google's popup would, with the credential (a Google ID token) for the API.
 */
function installFakeGoogle() {
  let callback: ((response: GoogleCredentialResponse) => void) | undefined;
  const initialize = vi.fn<GoogleAccountsId['initialize']>((config) => {
    callback = config.callback;
  });
  const renderButton = vi.fn<GoogleAccountsId['renderButton']>((parent) => {
    const button = document.createElement('button');
    button.textContent = 'Sign in with Google';
    parent.appendChild(button);
  });
  (window as GoogleWindow).google = {
    accounts: { id: { initialize, renderButton } },
  };
  return {
    initialize,
    renderButton,
    lastOptions: (): GoogleButtonOptions => renderButton.mock.lastCall![1],
    signIn: (credential: string) => callback!({ credential }),
  };
}

describe('LoginComponent: Sign in with Google', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
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
  });

  afterEach(() => {
    http.verify();
    delete (window as GoogleWindow).google;
    document.head
      .querySelectorAll(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`)
      .forEach((script) => script.remove());
  });

  async function settle() {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function open(clientId: string | null, returnUrl?: string) {
    if (returnUrl) {
      await router.navigateByUrl(
        `/login?returnUrl=${encodeURIComponent(returnUrl)}`,
      );
    }
    fixture = TestBed.createComponent(LoginComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    http.expectOne('/api/auth/google/config').flush({ clientId });
    await settle();
  }

  const text = () => el.textContent ?? '';
  const googleArea = () =>
    el.querySelector<HTMLElement>('[data-testid="google-sign-in"]')!;
  const alert = () => el.querySelector('[role="alert"]')?.textContent?.trim();
  const gsiScripts = () =>
    document.head.querySelectorAll(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);

  /** Completes a Google sign-in and answers the API's request for it. */
  async function signInWithGoogle(
    google: ReturnType<typeof installFakeGoogle>,
    answer: { body: object | null; status?: number },
  ) {
    google.signIn('google-id-token');
    await fixture.whenStable();
    const req = http.expectOne('/api/auth/google');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ credential: 'google-id-token' });
    req.flush(answer.body, {
      status: answer.status ?? 201,
      statusText: answer.status ? 'Error' : 'Created',
    });
    await settle();
  }

  it('shows no Google button, and loads nothing from Google, while the API has no client id', async () => {
    await open(null);

    expect(googleArea().childElementCount).toBe(0);
    expect(text()).not.toContain(en.auth.login.google.hint);
    expect(gsiScripts().length).toBe(0);
  });

  it("shows Google's button, for this app's client id, in popup mode and without One Tap", async () => {
    const google = installFakeGoogle();

    await open('client-1.apps.googleusercontent.com');

    expect(google.initialize).toHaveBeenCalledTimes(1);
    expect(google.initialize.mock.lastCall![0]).toMatchObject({
      client_id: 'client-1.apps.googleusercontent.com',
      ux_mode: 'popup',
      auto_select: false,
    });
    expect(google.lastOptions()).toMatchObject({
      type: 'standard',
      text: 'signin_with',
      theme: 'outline',
      locale: 'en',
    });
    expect(googleArea().textContent).toContain('Sign in with Google');
    expect(text()).toContain(en.auth.login.or);
    expect(text()).toContain(en.auth.login.google.hint);
  });

  it("loads Google's script once it is set up, and shows the button when it has loaded", async () => {
    await open('client-1');

    expect(gsiScripts().length).toBe(1);
    expect(googleArea().childElementCount).toBe(0);

    const google = installFakeGoogle();
    gsiScripts()[0].dispatchEvent(new Event('load'));
    await settle();

    expect(google.initialize).toHaveBeenCalledTimes(1);
    expect(googleArea().textContent).toContain('Sign in with Google');
  });

  it("leaves only the password login when Google's script can't load", async () => {
    await open('client-1');

    gsiScripts()[0].dispatchEvent(new Event('error'));
    await settle();

    expect(googleArea().childElementCount).toBe(0);
    expect(text()).not.toContain(en.auth.login.google.hint);
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('draws the button again in the language and theme the person switches to', async () => {
    const google = installFakeGoogle();
    await open('client-1');

    // The language loads before it switches.
    TestBed.inject(LanguageService).setLanguage('bg');
    TestBed.inject(ThemeService).setMode('dark');
    await vi.waitFor(async () => {
      await settle();
      expect(google.lastOptions().locale).toBe('bg');
    });

    expect(google.lastOptions()).toMatchObject({
      locale: 'bg',
      theme: 'filled_black',
    });
    // Drawn again in place of the old one, not beside it.
    expect(googleArea().querySelectorAll('button').length).toBe(1);
  });

  it("signs in with Google's credential like a password login: token stored, start page", async () => {
    const google = installFakeGoogle();
    await open('client-1');
    const token = makeToken({
      sub: 'account-1',
      role: 'TRAINEE',
      setupRequired: false,
    });

    await signInWithGoogle(google, {
      body: { accessToken: token, account: {} },
    });

    expect(localStorage.getItem('accessToken')).toBe(token);
    expect(router.url).toBe('/home');
  });

  it('goes back to the page that needed a sign-in, through the first-login setup when it is due', async () => {
    const google = installFakeGoogle();
    await open('client-1', '/schedule/s-1');

    await signInWithGoogle(google, {
      body: {
        accessToken: makeToken({
          sub: 'account-1',
          role: 'TRAINEE',
          setupRequired: true,
        }),
        account: {},
      },
    });

    expect(router.url).toBe('/account-setup?returnUrl=%2Fschedule%2Fs-1');
  });

  it("asks about an admin's seeded password as after a password login", async () => {
    const google = installFakeGoogle();
    await open('client-1');

    await signInWithGoogle(google, {
      body: {
        accessToken: makeToken({ sub: 'account-1', role: 'ADMIN' }),
        account: {},
      },
    });
    http
      .expectOne('/api/accounts/account-1/password-status')
      .flush({ accountId: 'account-1', hasUpdatedInitialPassword: false });
    await settle();

    expect(router.url).toBe('/change-password');
  });

  it('takes no second click on the Google button while a sign-in is being checked', async () => {
    const google = installFakeGoogle();
    await open('client-1');

    google.signIn('google-id-token');
    await fixture.whenStable();

    expect(googleArea().classList).toContain('is-busy');
    expect(googleArea().getAttribute('aria-busy')).toBe('true');
    http
      .expectOne('/api/auth/google')
      .flush({ message: 'x' }, { status: 401, statusText: 'Error' });
    await settle();
    expect(googleArea().classList).not.toContain('is-busy');
  });

  describe('when the API refuses the Google sign-in', () => {
    it.each([
      ['GOOGLE_NO_ACCOUNT', 401, en.auth.login.google.noAccount],
      ['GOOGLE_EMAIL_NOT_ACCEPTED', 401, en.auth.login.google.notAccepted],
      ['GOOGLE_TOKEN_INVALID', 401, en.auth.login.google.error],
    ])(
      'explains %s in the chosen language and stores no token',
      async (code, status, shown) => {
        const google = installFakeGoogle();
        await open('client-1');

        await signInWithGoogle(google, {
          body: { statusCode: status, message: 'English message', error: code },
          status,
        });

        expect(alert()).toBe(shown);
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(router.url).toBe('/');
      },
    );

    it('says a 403 means the account waits to be connected, as for the password', async () => {
      const google = installFakeGoogle();
      await open('client-1');

      await signInWithGoogle(google, {
        body: { message: 'Your account is not connected to a profile yet.' },
        status: 403,
      });

      expect(alert()).toBe(en.auth.login.notLinked);
    });

    it('says Google sign-in is unavailable on a 503', async () => {
      const google = installFakeGoogle();
      await open('client-1');

      await signInWithGoogle(google, {
        body: { message: 'Google sign-in is not set up' },
        status: 503,
      });

      expect(alert()).toBe(en.auth.login.google.unavailable);
    });

    it('shows any other refusal as the API says it (e.g. a disabled account)', async () => {
      const google = installFakeGoogle();
      await open('client-1');

      await signInWithGoogle(google, {
        body: { message: 'Account is not active (DISABLED)' },
        status: 401,
      });

      expect(alert()).toBe('Account is not active (DISABLED)');
    });
  });
});
