import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { RegisterComponent } from './register.component';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegisterComponent);
    page = driver(
      () => fixture.nativeElement as HTMLElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    await page.settle();
  });

  afterEach(() => http.verify());

  async function fillRequired() {
    await page.type('#register-name', '  Ivan Petrov ');
    await page.type('#register-email', ' ivan@example.com ');
    await page.type('#register-password', 'my-pass-123');
    await page.type('#register-confirm', 'my-pass-123');
    await page.type('#register-phone', ' +359 88 123 4567 ');
  }

  it('offers the active gyms and gym subscriptions, and never a nickname', () => {
    const gymOptions = page
      .queryAll<HTMLOptionElement>('#register-home-gym option')
      .map((o) => o.textContent?.trim());
    expect(gymOptions).toEqual([en.contact.noGym, 'Center', 'Lozenets']);
    const cardOptions = page
      .queryAll<HTMLOptionElement>('#register-gym-subscription option')
      .map((o) => o.textContent?.trim());
    expect(cardOptions).toEqual([en.contact.noGymSubscription, 'MultiSport']);

    expect(page.query('[id*="nickname"]')).toBeNull();
    expect(page.text()).not.toContain(en.accountsAdmin.fields.nickname);
  });

  it('sends nothing without the consent, and says it is needed', async () => {
    await fillRequired();
    await page.submit();

    http.expectNone('/api/auth/register');
    expect(page.text()).toContain(en.register.consentRequired);
  });

  it('sends nothing when the fields are empty or wrong', async () => {
    await page.submit();
    http.expectNone('/api/auth/register');
    expect(page.text()).toContain(en.register.nameError);
    expect(page.text()).toContain(en.register.emailRequired);
    expect(page.text()).toContain(en.contact.phoneRequired);

    await fillRequired();
    await page.type('#register-confirm', 'other-pass-1');
    await page.type('#register-phone', '12345');
    await page.check('#register-consent', true);
    await page.submit();
    http.expectNone('/api/auth/register');
    expect(page.text()).toContain(en.register.mismatch);
    expect(page.text()).toContain(en.contact.phoneError);
  });

  it('posts the details, trimmed, with empty optional fields as null, then says what happens next', async () => {
    await fillRequired();
    await page.select('#register-home-gym', 'gym-2');
    await page.type('#register-instagram', ' @ivan ');
    await page.check('#register-consent', true);
    await page.submit();

    const req = http.expectOne('/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'ivan@example.com',
      password: 'my-pass-123',
      confirmPassword: 'my-pass-123',
      name: 'Ivan Petrov',
      phone: '+359 88 123 4567',
      gymSubscriptionId: null,
      preferredGymId: 'gym-2',
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
      acceptTerms: true,
    });
    req.flush({ id: 'a1', email: 'ivan@example.com', role: 'TRAINEE' });
    await page.settle();

    const done = page.query('[data-testid="register-done"]')!;
    expect(done.textContent).toContain(
      en.register.doneMessage.replace('{email}', 'ivan@example.com'),
    );
    expect(page.query('form')).toBeNull();
    expect(
      page
        .query<HTMLAnchorElement>('[data-testid="register-done"] a')!
        .getAttribute('href'),
    ).toBe('/login');
  });

  it('shows the API message (e.g. a taken email) and keeps the form', async () => {
    await fillRequired();
    await page.check('#register-consent', true);
    await page.submit();

    const { body, options } = apiError(
      'Email is already used by another account',
      409,
    );
    http.expectOne('/api/auth/register').flush(body, options);
    await page.settle();

    expect(page.alert()).toBe('Email is already used by another account');
    expect(page.query('form')).not.toBeNull();
  });
});
