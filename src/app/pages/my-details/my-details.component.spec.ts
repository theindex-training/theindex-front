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
    photo: null,
    ...extra,
  };
}

const PHOTO = {
  url: 'https://media.test/profile-photos/p1/s512.webp',
  thumbnailUrl: 'https://media.test/profile-photos/p1/s128.webp',
  crop: { x: 0.1, y: 0, width: 0.8, height: 1, rotation: 0 as const },
  updatedAt: '2026-11-18T10:00:00.000Z',
};

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

  describe('profile photo', () => {
    const texts = en.myDetails.photo;
    const section = () => page.query('[data-testid="profile-photo"]')!;
    const current = () =>
      page
        .query('[data-testid="profile-photo-current"] img')
        ?.getAttribute('src') ?? null;
    const button = (label: string) =>
      Array.from(section().querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label,
      );

    afterEach(() => vi.restoreAllMocks());

    it('offers an upload with initials when there is no photo, nothing else', async () => {
      await open(trainee());

      expect(current()).toBeNull();
      expect(
        page.query('[data-testid="profile-photo-current"]')!.textContent,
      ).toContain('IP');
      expect(section().textContent).toContain(texts.none);
      expect(button(texts.upload)).toBeDefined();
      expect(button(texts.adjust)).toBeUndefined();
      expect(button(texts.remove)).toBeUndefined();
      expect(
        page
          .query('[data-testid="profile-photo-file"]')!
          .getAttribute('accept'),
      ).toBe('image/jpeg,image/png,image/webp');
    });

    it('shows the photo with Choose another, Adjust and Remove', async () => {
      await open(trainee({ photo: PHOTO }));

      expect(current()).toBe(PHOTO.url);
      expect(section().textContent).toContain(texts.shown);
      expect(button(texts.change)).toBeDefined();
      expect(button(texts.adjust)).toBeDefined();
      expect(button(texts.remove)).toBeDefined();
    });

    it('refuses a file of another type or over 15 MB before sending anything', async () => {
      await open(trainee());
      const input = page.query<HTMLInputElement>(
        '[data-testid="profile-photo-file"]',
      )!;
      const choose = async (file: File) => {
        Object.defineProperty(input, 'files', {
          value: [file],
          configurable: true,
        });
        input.dispatchEvent(new Event('change'));
        await page.settle();
      };

      await choose(new File(['gif'], 'a.gif', { type: 'image/gif' }));
      expect(section().textContent).toContain(texts.wrongType);

      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 15 * 1024 * 1024 + 1 });
      await choose(big);
      expect(section().textContent).toContain(texts.tooLarge);
      expect(section().textContent).not.toContain(texts.wrongType);
      expect(page.query('[data-testid="profile-photo-editor"]')).toBeNull();
    });

    it('removes the photo after asking, then shows the initials again', async () => {
      await open(trainee({ photo: PHOTO }));
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      button(texts.remove)!.click();
      await page.settle();
      expect(confirm).toHaveBeenCalledWith(texts.removeConfirm);
      http.expectNone('/api/my-profile/photo');

      confirm.mockReturnValue(true);
      button(texts.remove)!.click();
      await page.settle();
      http
        .expectOne({ method: 'DELETE', url: '/api/my-profile/photo' })
        .flush(null, { status: 204, statusText: 'No Content' });
      await page.settle();

      expect(current()).toBeNull();
      expect(section().textContent).toContain(texts.removed);
      expect(button(texts.upload)).toBeDefined();
    });

    it("shows the API's message when removing fails, keeping the photo", async () => {
      await open(trainee({ photo: PHOTO }));
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      button(texts.remove)!.click();
      await page.settle();
      const error = apiError('You have no profile photo', 404);
      http.expectOne('/api/my-profile/photo').flush(error.body, error.options);
      await page.settle();

      expect(section().textContent).toContain('You have no profile photo');
      expect(current()).toBe(PHOTO.url);
    });

    it('fetches the kept picture to adjust the crop, and says so when it fails', async () => {
      await open(trainee({ photo: PHOTO }));

      button(texts.adjust)!.click();
      await page.settle();
      expect(section().textContent).toContain(texts.loadingOriginal);
      const req = http.expectOne({
        method: 'GET',
        url: '/api/my-profile/photo/original',
      });
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['{}']), { status: 500, statusText: 'Error' });
      await page.settle();

      expect(section().textContent).toContain(texts.loadError);
      expect(page.query('[data-testid="profile-photo-editor"]')).toBeNull();
    });
  });
});
