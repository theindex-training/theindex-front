import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { AccountView } from '../../services/accounts.service';
import { AccountDetailsComponent } from './account-details.component';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

function waiting(extra: Partial<AccountView> = {}): AccountView {
  return {
    id: 'a1',
    email: 'ivan@example.com',
    role: 'TRAINEE',
    status: 'ACTIVE',
    createdAt: '2026-11-10T08:00:00.000Z',
    consentAt: '2026-11-10T08:00:00.000Z',
    registration: {
      name: 'Ivan Petrov',
      phone: '+359 88 123 4567',
      gymSubscription: { id: 'gs-1', name: 'MultiSport' },
      preferredGym: { id: 'gym-1', name: 'Center' },
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
    },
    profile: null,
    ...extra,
  };
}

describe('AccountDetailsComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'accounts/:id', component: AccountDetailsComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  /**
   * Opens the page. An account that can be connected also loads the active trainees, since
   * "Existing profile" is the default: `candidates` answers that request.
   */
  async function open(account: AccountView, candidates: object[] = []) {
    await harness.navigateByUrl('/accounts/a1', AccountDetailsComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    http.expectOne('/api/accounts/a1/details').flush(account);
    await page.settle();
    if (!account.profile && account.role !== 'ADMIN') {
      http
        .expectOne(
          (r) => r.url === '/api/trainees' && r.params.get('active') === 'true',
        )
        .flush(candidates);
      await page.settle();
    }
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement | HTMLSelectElement>(selector)!.value;

  async function choose(groupLabel: string, option: string) {
    const group = page
      .queryAll('fieldset')
      .find(
        (f) => f.querySelector('legend')?.textContent?.trim() === groupLabel,
      )!;
    const radio = Array.from(group.querySelectorAll('label')).find(
      (label) => label.textContent?.trim() === option,
    )!;
    radio.click();
    await page.settle();
  }

  const checked = (groupLabel: string) =>
    page
      .queryAll('fieldset')
      .find(
        (f) => f.querySelector('legend')?.textContent?.trim() === groupLabel,
      )!
      .querySelector('input:checked')!
      .parentElement!.textContent.trim();

  const connectButton = () =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((b) => b.textContent?.trim() === en.accountsAdmin.connect.submit);

  const differences = () =>
    page
      .queryAll('[data-testid="field-difference"]')
      .map((d) => d.textContent.replace(/\s+/g, ' ').trim());

  it('shows what they registered, and starts on Existing profile with the form filled from the registration', async () => {
    await open(waiting(), [
      {
        id: 't1',
        name: 'Maria',
        nickname: null,
        accountId: null,
        isActive: true,
      },
    ]);

    const registered = page.query(
      '[data-testid="account-registration"]',
    )!.textContent;
    expect(registered).toContain('Ivan Petrov');
    expect(registered).toContain('+359 88 123 4567');
    expect(registered).toContain('MultiSport');
    expect(registered).toContain('Center');
    expect(
      page.query<HTMLAnchorElement>(
        '[data-testid="account-registration"] a[href="https://www.instagram.com/ivan"]',
      ),
    ).not.toBeNull();

    expect(checked(en.accountsAdmin.connect.modeLabel)).toBe(
      en.accountsAdmin.connect.existingProfile,
    );
    expect(page.query('#account-link-profile')!.textContent).toContain('Maria');
    expect(value('#account-link-profile')).toBe('');

    // Only the list until a profile is picked: no fields, differences or Connect.
    expect(page.query('#account-link-name')).toBeNull();
    expect(page.query('#account-link-phone')).toBeNull();
    expect(page.query('[data-testid="account-link-differences"]')).toBeNull();
    expect(connectButton()).toBeUndefined();

    await page.select('#account-link-profile', 't1');
    expect(value('#account-link-name')).toBe('Ivan Petrov');
    expect(value('#account-link-nickname')).toBe('');
    expect(value('#account-link-phone')).toBe('+359 88 123 4567');
    expect(value('#account-link-gym-subscription')).toBe('gs-1');
    expect(value('#account-link-home-gym')).toBe('gym-1');
    expect(value('#account-link-instagram')).toBe('@ivan');
    // The profile's own name differs from the registered one.
    expect(differences()).toEqual([
      `${en.contact.difference.inProfile.replace('{value}', 'Maria')} ${en.contact.difference.use}`,
    ]);
    expect(connectButton()).toBeDefined();

    // Back to no profile: the fields go again.
    await page.select('#account-link-profile', '');
    expect(page.query('#account-link-name')).toBeNull();
  });

  it('connects to a new trainee with what the admin decided, then shows the profile', async () => {
    await open(waiting());
    await choose(
      en.accountsAdmin.connect.modeLabel,
      en.accountsAdmin.connect.newProfile,
    );
    expect(page.query('#account-link-profile')).toBeNull();
    await page.type('#account-link-name', ' Ivan P. ');
    await page.type('#account-link-nickname', 'Vanko');
    await page.select('#account-link-home-gym', 'gym-2');
    await page.submit('[data-testid="account-connect"]');

    const req = http.expectOne('/api/accounts/a1/link');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      profileType: 'trainee',
      name: 'Ivan P.',
      nickname: 'Vanko',
      phone: '+359 88 123 4567',
      gymSubscriptionId: 'gs-1',
      homeGymId: 'gym-2',
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
    });
    req.flush(
      waiting({
        profile: {
          type: 'trainee',
          id: 't9',
          name: 'Ivan P.',
          nickname: 'Vanko',
          isActive: true,
        },
      }),
    );
    await page.settle();

    expect(page.query('[data-testid="account-connect"]')).toBeNull();
    expect(page.text()).toContain(
      en.accountsAdmin.connect.success.replace('{name}', 'Ivan P.'),
    );
    expect(
      page
        .query<HTMLAnchorElement>('[data-testid="account-profile"] a')!
        .getAttribute('href'),
    ).toBe('/trainees/t9');
    // Connected: no longer deletable.
    expect(page.text()).not.toContain(en.accountsAdmin.delete.submit);
  });

  it('an existing trainee: what they registered first, the profile’s differing values shown under their fields', async () => {
    await open(waiting(), [
      {
        id: 't2',
        name: 'Ivan Georgiev',
        nickname: 'Vanko',
        accountId: null,
        isActive: true,
        phone: '0888 000 111',
        gymSubscriptionId: 'gs-1',
        preferredGymId: 'gym-2',
        tiktok: '@vanko',
      },
    ]);
    await page.select('#account-link-profile', 't2');

    // The registration wins; the profile fills what they left empty.
    expect(value('#account-link-name')).toBe('Ivan Petrov');
    expect(value('#account-link-nickname')).toBe('Vanko');
    expect(value('#account-link-phone')).toBe('+359 88 123 4567');
    expect(value('#account-link-home-gym')).toBe('gym-1');
    expect(value('#account-link-tiktok')).toBe('@vanko');

    expect(
      page.query('[data-testid="account-link-differences"]')!.textContent,
    ).toContain('3 fields differ');
    const inProfile = (v: string) =>
      `${en.contact.difference.inProfile.replace('{value}', v)} ${en.contact.difference.use}`;
    expect(differences()).toEqual([
      inProfile('Ivan Georgiev'),
      inProfile('0888 000 111'),
      inProfile('Lozenets'),
    ]);
    expect(
      page.query('#account-link-phone')!.getAttribute('aria-describedby'),
    ).toBe('account-link-phone-help account-link-phone-diff');

    // "Use it" puts the profile's value in the field, and the note goes.
    const usePhone = page.query<HTMLButtonElement>(
      '#account-link-phone-diff button',
    )!;
    usePhone.click();
    await page.settle();
    expect(value('#account-link-phone')).toBe('0888 000 111');
    expect(differences()).toEqual([
      inProfile('Ivan Georgiev'),
      inProfile('Lozenets'),
    ]);

    await page.submit('[data-testid="account-connect"]');
    const req = http.expectOne('/api/accounts/a1/link');
    expect(req.request.body).toEqual({
      profileType: 'trainee',
      profileId: 't2',
      name: 'Ivan Petrov',
      nickname: 'Vanko',
      phone: '0888 000 111',
      gymSubscriptionId: 'gs-1',
      homeGymId: 'gym-1',
      instagram: '@ivan',
      facebook: null,
      tiktok: '@vanko',
    });
    req.flush(waiting());
    await page.settle();
  });

  it('an existing trainer: suggestions first, taken trainers left out, no gym subscription', async () => {
    await open(waiting());
    await choose(
      en.accountsAdmin.connect.typeLabel,
      en.accountsAdmin.connect.trainer,
    );

    http
      .expectOne(
        (r) => r.url === '/api/trainers' && r.params.get('active') === 'true',
      )
      .flush([
        {
          id: 'tr1',
          name: 'Georgi',
          nickname: null,
          accountId: null,
          isActive: true,
        },
        {
          id: 'tr2',
          name: 'Ivan Petrov',
          nickname: 'Vanko',
          accountId: null,
          isActive: true,
          phone: '0881234567',
          primaryGymId: 'gym-1',
        },
        {
          id: 'tr3',
          name: 'Ivan Taken',
          nickname: null,
          accountId: 'other',
          isActive: true,
        },
      ]);
    await page.settle();

    const groups = page.queryAll<HTMLOptGroupElement>(
      '#account-link-profile optgroup',
    );
    expect(groups.map((g) => g.label)).toEqual([
      en.accountsAdmin.connect.suggested,
      en.accountsAdmin.connect.others,
    ]);
    expect(groups[0].textContent).toContain('Ivan Petrov');
    expect(groups[1].textContent).toContain('Georgi');
    expect(page.query('#account-link-profile')!.textContent).not.toContain(
      'Ivan Taken',
    );

    // The same values written differently are no difference.
    await page.select('#account-link-profile', 'tr2');
    expect(page.query('#account-link-name')).not.toBeNull();
    expect(page.query('#account-link-gym-subscription')).toBeNull();
    expect(page.query('[data-testid="account-link-differences"]')).toBeNull();
    expect(differences()).toEqual([]);

    await page.submit('[data-testid="account-connect"]');
    const req = http.expectOne('/api/accounts/a1/link');
    expect(req.request.body).toEqual({
      profileType: 'trainer',
      profileId: 'tr2',
      name: 'Ivan Petrov',
      nickname: 'Vanko',
      phone: '+359 88 123 4567',
      homeGymId: 'gym-1',
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
    });
    req.flush(
      waiting({
        role: 'TRAINER',
        profile: {
          type: 'trainer',
          id: 'tr2',
          name: 'Ivan Petrov',
          nickname: 'Vanko',
          isActive: true,
        },
      }),
    );
    await page.settle();
    expect(
      page
        .query<HTMLAnchorElement>('[data-testid="account-profile"] a')!
        .getAttribute('href'),
    ).toBe('/trainers/tr2');
  });

  it('shows the API error when connecting fails', async () => {
    await open(waiting(), [
      {
        id: 't1',
        name: 'Maria',
        nickname: null,
        accountId: null,
        isActive: true,
      },
    ]);

    await page.select('#account-link-profile', 't1');
    await page.submit('[data-testid="account-connect"]');
    const { body, options } = apiError(
      'This trainee already has an account',
      409,
    );
    http.expectOne('/api/accounts/a1/link').flush(body, options);
    await page.settle();
    expect(page.alert()).toBe('This trainee already has an account');
  });

  it('deletes an unconnected account after confirming, then goes back to the list', async () => {
    await open(waiting());
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButton = () =>
      page
        .queryAll<HTMLButtonElement>('button')
        .find((b) => b.textContent?.trim() === en.accountsAdmin.delete.submit)!;

    deleteButton().click();
    await page.settle();
    http.expectNone('/api/accounts/a1/permanent');
    expect(confirm).toHaveBeenCalledWith(
      en.accountsAdmin.delete.confirm.replace('{email}', 'ivan@example.com'),
    );

    confirm.mockReturnValue(true);
    deleteButton().click();
    await page.settle();
    http
      .expectOne({ method: 'DELETE', url: '/api/accounts/a1/permanent' })
      .flush({ id: 'a1', deleted: true });
    await page.settle();
    expect(router.url).toBe('/accounts');
  });

  it('offers neither connecting nor deleting for a connected or an admin account', async () => {
    await open(
      waiting({
        profile: {
          type: 'trainee',
          id: 't1',
          name: 'Ivan',
          nickname: null,
          isActive: true,
        },
      }),
    );
    expect(page.query('[data-testid="account-connect"]')).toBeNull();
    expect(page.text()).not.toContain(en.accountsAdmin.delete.submit);

    await harness.navigateByUrl('/');
    await open(waiting({ role: 'ADMIN', registration: null, consentAt: null }));
    expect(page.query('[data-testid="account-connect"]')).toBeNull();
    expect(page.text()).toContain(en.accountsAdmin.details.adminNote);
    expect(
      page.query('[data-testid="account-consent"]')!.textContent,
    ).toContain(en.accountsAdmin.details.consentNone);
  });
});
