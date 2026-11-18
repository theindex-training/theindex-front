import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { makeToken, signInAs } from '../../../testing/jwt';
import { MyProfile } from '../../services/my-profile.service';
import { UserBlockComponent } from './user-block.component';

function profile(extra: Partial<MyProfile> = {}): MyProfile {
  return {
    profileType: 'trainee',
    email: 'ivan@example.com',
    name: 'Ivan Petrov',
    phone: '0888 123 456',
    gymSubscriptionId: null,
    homeGymId: null,
    instagram: null,
    facebook: null,
    tiktok: null,
    consentAt: null,
    photo: null,
    ...extra,
  };
}

const PHOTO = {
  url: 'https://media.test/profile-photos/p1/s512.webp',
  thumbnailUrl: 'https://media.test/profile-photos/p1/s128.webp',
  crop: { x: 0, y: 0, width: 1, height: 1, rotation: 0 as const },
  updatedAt: '2026-11-18T10:00:00.000Z',
};

describe('UserBlockComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  // Trainees and trainers load their profile for the avatar; tests that don't care leave it
  // unanswered.
  afterEach(() => http.match('/api/my-profile'));

  const avatar = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('[data-testid="user-avatar"]')!;
  const photoOf = (el: HTMLElement) =>
    avatar(el).querySelector('img')?.getAttribute('src') ?? null;

  async function render() {
    const fixture = TestBed.createComponent(UserBlockComponent);
    await fixture.whenStable();
    return {
      fixture,
      component: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it('shows the email, its initials and the translated role', async () => {
    signInAs('TRAINER', { email: 'coach.petar@gym.test' });
    const { component, el } = await render();

    expect(component.initials).toBe('CO');
    expect(el.textContent).toContain('coach.petar@gym.test');
    expect(el.textContent).toContain(en.enums.role.TRAINER);
  });

  it('skips non-alphanumeric characters for the initials', async () => {
    signInAs('ADMIN', { email: '_.x9@gym.test' });

    expect((await render()).component.initials).toBe('X9');
  });

  it('falls back to "U", "User" and "Signed in" without an email or role', async () => {
    localStorage.setItem('accessToken', makeToken({}));
    const { component, el } = await render();

    expect(component.initials).toBe('U');
    expect(el.textContent).toContain(en.common.user);
    expect(el.textContent).toContain(en.common.signedIn);
  });

  it('logs out: the token is removed and the app goes to /login', async () => {
    signInAs('ADMIN');
    const { fixture, el } = await render();

    const logOut = Array.from(el.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === en.common.logOut,
    )!;
    logOut.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('links trainees and trainers to My details, but not admins', async () => {
    const myDetails = (el: HTMLElement) =>
      Array.from(el.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === en.common.myDetails,
      );

    for (const role of ['TRAINEE', 'TRAINER'] as const) {
      signInAs(role);
      const { el } = await render();
      expect(myDetails(el)?.getAttribute('href')).toBe('/my-details');
    }

    signInAs('ADMIN');
    expect(myDetails((await render()).el)).toBeUndefined();
  });

  it("shows a trainee's or trainer's name initials once their profile loads, and their photo instead when they have one", async () => {
    signInAs('TRAINEE', { email: 'vanko77@gym.test' });
    const { fixture, el } = await render();
    // Until the profile answers: the email's letters.
    expect(avatar(el).textContent?.trim()).toBe('VA');

    http.expectOne('/api/my-profile').flush(profile());
    await fixture.whenStable();
    expect(avatar(el).textContent?.trim()).toBe('IP');
    expect(photoOf(el)).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    signInAs('TRAINER', { email: 'coach@gym.test' });
    const trainer = await render();
    http
      .expectOne('/api/my-profile')
      .flush(profile({ profileType: 'trainer', photo: PHOTO }));
    await trainer.fixture.whenStable();
    // The photo, and no letters next to it.
    expect(photoOf(trainer.el)).toBe(PHOTO.thumbnailUrl);
    expect(avatar(trainer.el).textContent?.trim()).toBe('');
  });

  it('loads the profile once for both user blocks, and admins never ask', async () => {
    signInAs('TRAINEE');
    await render();
    await render();
    expect(http.match('/api/my-profile')).toHaveLength(1);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    signInAs('ADMIN', { email: 'boss@gym.test' });
    const { el } = await render();
    http.expectNone('/api/my-profile');
    expect(avatar(el).textContent?.trim()).toBe('BO');
  });

  it('keeps the email initials when the profile cannot be loaded', async () => {
    signInAs('TRAINER', { email: 'coach@gym.test' });
    const { fixture, el } = await render();
    http
      .expectOne('/api/my-profile')
      .flush({ message: 'Down' }, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(avatar(el).textContent?.trim()).toBe('CO');
  });
});
