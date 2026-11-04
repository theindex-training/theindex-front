import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { makeToken, signInAs } from '../../../testing/jwt';
import { ChangePasswordComponent } from './change-password.component';

const copy = en.auth.changePassword;
const STATUS_URL = '/api/accounts/account-trainer/password-status';
const CHANGE_URL = '/api/accounts/account-trainer/change-password';

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/change-password');
  });

  afterEach(() => http.verify());

  async function render(passwordChanged?: boolean | 'error') {
    fixture = TestBed.createComponent(ChangePasswordComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    if (passwordChanged === 'error') {
      http
        .expectOne(STATUS_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });
    } else if (passwordChanged !== undefined) {
      const req = http.expectOne(STATUS_URL);
      expect(req.request.method).toBe('GET');
      req.flush({
        accountId: 'account-trainer',
        hasUpdatedInitialPassword: passwordChanged,
      });
    }
    await settle();
  }

  async function settle() {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  async function type(id: string, value: string) {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function fillPasswords(
    current = 'old-password',
    next = 'new-password',
    confirm = next,
  ) {
    await type('currentPassword', current);
    await type('newPassword', next);
    await type('confirmPassword', confirm);
  }

  async function submit() {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  const text = () => el.textContent ?? '';
  const phoneField = () => el.querySelector('#phone');

  describe('first password change (initial password not yet updated)', () => {
    beforeEach(async () => {
      signInAs('TRAINER');
      await render(false);
    });

    it('asks for a phone number and requires it', async () => {
      expect(phoneField()).not.toBeNull();
      expect(text()).toContain(copy.phoneHint);

      await fillPasswords();
      await submit();

      http.expectNone(CHANGE_URL);
      expect(text()).toContain(copy.phoneError);
    });

    it('silently does nothing when the phone is only spaces', async () => {
      await fillPasswords();
      await type('phone', '   ');
      await submit();

      http.expectNone(CHANGE_URL);
      // CHARACTERIZATION: possibly unintended — "   " passes Validators.required, so no error is
      // shown, but handleSubmit drops it after trimming and returns: nothing happens and nothing
      // explains why. TEST_NOTES.md S14.
      expect(text()).not.toContain(copy.phoneError);
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('sends the passwords and the trimmed phone, then goes home', async () => {
      await fillPasswords('old-password', 'new-password');
      await type('phone', ' +359 888 123 456 ');
      await submit();

      const req = http.expectOne(CHANGE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
        phone: '+359 888 123 456',
      });
      req.flush({
        accountId: 'account-trainer',
        hasUpdatedInitialPassword: true,
      });
      await settle();

      expect(router.url).toBe('/home');
    });
  });

  describe('later password changes', () => {
    beforeEach(async () => {
      signInAs('TRAINER');
      await render(true);
    });

    it('does not ask for a phone and sends only the passwords', async () => {
      expect(phoneField()).toBeNull();

      await fillPasswords();
      await submit();

      expect(http.expectOne(CHANGE_URL).request.body).toEqual({
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });
    });

    it('requires at least 8 characters in every password field', async () => {
      await fillPasswords('short', 'short', 'short');
      await submit();

      http.expectNone(CHANGE_URL);
      expect(text()).toContain(copy.currentLength);
      expect(text()).toContain(copy.newLength);
    });

    it('shows the required errors only after a field is touched', async () => {
      expect(text()).not.toContain(copy.currentRequired);

      await submit();

      http.expectNone(CHANGE_URL);
      expect(text()).toContain(copy.currentRequired);
      expect(text()).toContain(copy.newRequired);
      expect(text()).toContain(copy.repeat);
    });

    it('flags a confirmation that does not match, on the confirm field only', async () => {
      await fillPasswords('old-password', 'new-password', 'new-passw0rd');
      await submit();

      http.expectNone(CHANGE_URL);
      const confirmHelp = el.querySelector('#confirmPassword-help')!;
      expect(confirmHelp.textContent?.trim()).toBe(copy.mismatch);
      expect(el.querySelector('#newPassword-help')!.textContent?.trim()).toBe(
        copy.newHint,
      );
    });

    it('resets the form and navigates away on success, so the success notice is never seen', async () => {
      await fillPasswords();
      await submit();
      http.expectOne(CHANGE_URL).flush({
        accountId: 'account-trainer',
        hasUpdatedInitialPassword: true,
      });
      await settle();

      expect(router.url).toBe('/home');
      expect(fixture.componentInstance.form.getRawValue()).toEqual({
        currentPassword: null,
        newPassword: null,
        confirmPassword: null,
        phone: null,
      });
      // CHARACTERIZATION: possibly unintended — the success message is set right before navigating
      // away; in the app this component is destroyed, so users never see it. TEST_NOTES.md S5.
      expect(fixture.componentInstance.successMessage).toEqual({
        key: 'auth.changePassword.success',
      });
    });

    it('shows the API error and lets the user try again', async () => {
      await fillPasswords();
      await submit();
      http
        .expectOne(CHANGE_URL)
        .flush(
          { message: 'Current password is incorrect' },
          { status: 400, statusText: 'Bad Request' },
        );
      await settle();

      expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        'Current password is incorrect',
      );
      expect(text()).toContain(copy.save);
      expect(router.url).toBe('/change-password');
    });

    it('falls back to a generic error when the API sends no message', async () => {
      await fillPasswords();
      await submit();
      http
        .expectOne(CHANGE_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        copy.error,
      );
    });
  });

  it('sends a trainee to /my-profile after the change', async () => {
    signInAs('TRAINEE');
    fixture = TestBed.createComponent(ChangePasswordComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
    http
      .expectOne('/api/accounts/account-trainee/password-status')
      .flush({ accountId: 'account-trainee', hasUpdatedInitialPassword: true });
    await settle();

    await fillPasswords();
    await submit();
    http.expectOne('/api/accounts/account-trainee/change-password').flush({});
    await settle();

    expect(router.url).toBe('/my-profile');
  });

  it('does not ask for a phone when the password check fails', async () => {
    signInAs('TRAINER');
    await render('error');

    expect(phoneField()).toBeNull();
    expect(text()).not.toContain(copy.loading);
  });

  it('cannot change the password without an account id in the token', async () => {
    localStorage.setItem('accessToken', makeToken({ role: 'TRAINER' }));
    await render();

    http.expectNone((req) => req.url.includes('/api/accounts/'));
    await fillPasswords();
    await submit();

    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      copy.noAccount,
    );
  });
});
