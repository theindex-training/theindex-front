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

  async function open(account: AccountView) {
    await harness.navigateByUrl('/accounts/a1', AccountDetailsComponent);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    http.expectOne('/api/accounts/a1/details').flush(account);
    await page.settle();
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

  it('shows what they registered and starts the connect form from it', async () => {
    await open(waiting());

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

    expect(value('#account-link-name')).toBe('Ivan Petrov');
    expect(value('#account-link-nickname')).toBe('');
    expect(value('#account-link-phone')).toBe('+359 88 123 4567');
    expect(value('#account-link-gym-subscription')).toBe('gs-1');
    expect(value('#account-link-home-gym')).toBe('gym-1');
    expect(value('#account-link-instagram')).toBe('@ivan');
  });

  it('connects to a new trainee with what the admin decided, then shows the profile', async () => {
    await open(waiting());
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

  it('connects to an existing trainer: suggestions first, the form starts from the profile, no gym subscription', async () => {
    await open(waiting());
    await choose(
      en.accountsAdmin.connect.typeLabel,
      en.accountsAdmin.connect.trainer,
    );
    expect(page.query('#account-link-gym-subscription')).toBeNull();
    await choose(
      en.accountsAdmin.connect.modeLabel,
      en.accountsAdmin.connect.existingProfile,
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
          phone: '0888 000 111',
          primaryGymId: 'gym-2',
          tiktok: '@vanko',
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
    // A trainer who already has an account isn't offered.
    expect(page.query('#account-link-profile')!.textContent).not.toContain(
      'Ivan Taken',
    );

    await page.select('#account-link-profile', 'tr2');
    expect(value('#account-link-name')).toBe('Ivan Petrov');
    expect(value('#account-link-nickname')).toBe('Vanko');
    expect(value('#account-link-phone')).toBe('0888 000 111');
    expect(value('#account-link-home-gym')).toBe('gym-2');
    expect(value('#account-link-instagram')).toBe('@ivan');
    expect(value('#account-link-tiktok')).toBe('@vanko');

    await page.submit('[data-testid="account-connect"]');
    const req = http.expectOne('/api/accounts/a1/link');
    expect(req.request.body).toEqual({
      profileType: 'trainer',
      profileId: 'tr2',
      name: 'Ivan Petrov',
      nickname: 'Vanko',
      phone: '0888 000 111',
      homeGymId: 'gym-2',
      instagram: '@ivan',
      facebook: null,
      tiktok: '@vanko',
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

  it('asks for a profile before connecting to an existing one, and shows API errors', async () => {
    await open(waiting());
    await choose(
      en.accountsAdmin.connect.modeLabel,
      en.accountsAdmin.connect.existingProfile,
    );
    http
      .expectOne((r) => r.url === '/api/trainees')
      .flush([
        {
          id: 't1',
          name: 'Maria',
          nickname: null,
          accountId: null,
          isActive: true,
        },
      ]);
    await page.settle();

    await page.submit('[data-testid="account-connect"]');
    http.expectNone('/api/accounts/a1/link');
    expect(page.text()).toContain(en.accountsAdmin.connect.pickRequired);

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
