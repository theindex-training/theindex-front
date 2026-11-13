import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { MyProfile } from '../../services/my-profile.service';
import { MyDetailsComponent } from './my-details.component';

const OPTIONS = {
  gyms: [
    { id: 'gym-1', name: 'Center' },
    { id: 'gym-2', name: 'Lozenets' },
  ],
  gymSubscriptions: [{ id: 'gs-1', name: 'MultiSport' }],
};

function trainee(extra: Partial<MyProfile> = {}): MyProfile {
  return {
    profileType: 'trainee',
    email: 'ivan@example.com',
    name: 'Ivan Petrov',
    phone: '0888 123 456',
    gymSubscriptionId: 'gs-1',
    homeGymId: 'gym-1',
    instagram: '@ivan',
    facebook: null,
    tiktok: null,
    consentAt: '2026-11-10T08:00:00.000Z',
    ...extra,
  };
}

describe('MyDetailsComponent', () => {
  let fixture: ComponentFixture<MyDetailsComponent>;
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyDetailsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(profile: MyProfile) {
    fixture = TestBed.createComponent(MyDetailsComponent);
    page = driver(
      () => fixture.nativeElement as HTMLElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/auth/register/options').flush(OPTIONS);
    http.expectOne({ method: 'GET', url: '/api/my-profile' }).flush(profile);
    await page.settle();
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement | HTMLSelectElement>(selector)!.value;

  it('shows the name and email as fixed, and fills the rest; never a nickname', async () => {
    await open(trainee());

    expect(
      page.query('[data-testid="my-details-name"]')!.textContent,
    ).toContain('Ivan Petrov');
    expect(page.text()).toContain('ivan@example.com');
    expect(page.query('#my-details-name')).toBeNull();
    expect(page.query('[id*="nickname"]')).toBeNull();
    expect(page.text()).not.toContain(en.accountsAdmin.fields.nickname);

    expect(value('#my-details-phone')).toBe('0888 123 456');
    expect(value('#my-details-gym-subscription')).toBe('gs-1');
    expect(value('#my-details-home-gym')).toBe('gym-1');
    expect(value('#my-details-instagram')).toBe('@ivan');
    expect(page.query('[data-testid="my-details-consent"]')).not.toBeNull();
    expect(page.query('a[href="/change-password"]')).not.toBeNull();
  });

  it('saves a trainee’s changes, empty fields as null', async () => {
    await open(trainee());
    await page.type('#my-details-phone', ' +359 88 999 0000 ');
    await page.select('#my-details-gym-subscription', '');
    await page.select('#my-details-home-gym', 'gym-2');
    await page.type('#my-details-instagram', '');
    await page.type('#my-details-tiktok', '@ivan.trains');
    await page.submit();

    const req = http.expectOne({ method: 'PATCH', url: '/api/my-profile' });
    expect(req.request.body).toEqual({
      phone: '+359 88 999 0000',
      gymSubscriptionId: null,
      homeGymId: 'gym-2',
      instagram: null,
      facebook: null,
      tiktok: '@ivan.trains',
    });
    req.flush(
      trainee({
        phone: '+359 88 999 0000',
        gymSubscriptionId: null,
        homeGymId: 'gym-2',
        instagram: null,
        tiktok: '@ivan.trains',
      }),
    );
    await page.settle();
    expect(page.text()).toContain(en.myDetails.saved);
  });

  it('a trainer has no gym subscription to pick or send, and a primary gym', async () => {
    await open(trainee({ profileType: 'trainer', gymSubscriptionId: null }));

    expect(page.query('#my-details-gym-subscription')).toBeNull();
    expect(page.text()).toContain(en.contact.primaryGym);
    await page.submit();

    const req = http.expectOne({ method: 'PATCH', url: '/api/my-profile' });
    expect(req.request.body).not.toHaveProperty('gymSubscriptionId');
    req.flush(trainee({ profileType: 'trainer', gymSubscriptionId: null }));
    await page.settle();
  });

  it('keeps the phone required, and shows API errors', async () => {
    await open(trainee());
    await page.type('#my-details-phone', '');
    await page.submit();
    http.expectNone({ method: 'PATCH', url: '/api/my-profile' });
    expect(page.text()).toContain(en.contact.phoneRequired);

    await page.type('#my-details-phone', '0888 123 456');
    await page.submit();
    const { body, options } = apiError('Gym is inactive');
    http
      .expectOne({ method: 'PATCH', url: '/api/my-profile' })
      .flush(body, options);
    await page.settle();
    expect(page.alert()).toBe('Gym is inactive');
  });

  it('keeps a stored gym that is no longer offered selectable', async () => {
    await open(trainee({ homeGymId: 'gym-closed' }));
    expect(value('#my-details-home-gym')).toBe('gym-closed');
    expect(page.query('#my-details-home-gym')!.textContent).toContain(
      en.contact.unavailable,
    );
  });
});
