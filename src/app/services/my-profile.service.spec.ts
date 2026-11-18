import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signInAs } from '../../testing/jwt';
import {
  MyProfile,
  MyProfileService,
  PhotoCrop,
  ProfilePhoto,
} from './my-profile.service';

const CROP: PhotoCrop = {
  x: 0.25,
  y: 0,
  width: 0.5,
  height: 1,
  rotation: 90,
};

const PHOTO: ProfilePhoto = {
  url: 'https://media.test/profile-photos/p1/s512.webp',
  thumbnailUrl: 'https://media.test/profile-photos/p1/s128.webp',
  crop: CROP,
  updatedAt: '2026-11-18T10:00:00.000Z',
};

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

describe('MyProfileService photo and current profile', () => {
  let http: HttpTestingController;
  let service: MyProfileService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(MyProfileService);
  });

  afterEach(() => http.verify());

  it('uploads the picture with the crop as form fields (PUT)', () => {
    const file = new File(['jpeg'], 'me.jpg', { type: 'image/jpeg' });
    let answer: ProfilePhoto | undefined;
    service.uploadPhoto(file, CROP).subscribe((photo) => (answer = photo));

    const req = http.expectOne({
      method: 'PUT',
      url: '/api/my-profile/photo',
    });
    const body = req.request.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect((body.get('file') as File).name).toBe('me.jpg');
    expect(
      ['x', 'y', 'width', 'height', 'rotation'].map((f) => body.get(f)),
    ).toEqual(['0.25', '0', '0.5', '1', '90']);
    req.flush(PHOTO);
    expect(answer).toEqual(PHOTO);
  });

  it('re-crops with JSON (PATCH), reads the kept picture as a blob, removes (DELETE)', () => {
    service.recropPhoto(CROP).subscribe();
    const patch = http.expectOne({
      method: 'PATCH',
      url: '/api/my-profile/photo',
    });
    expect(patch.request.body).toEqual(CROP);
    patch.flush(PHOTO);

    let blob: Blob | undefined;
    service.photoOriginal().subscribe((b) => (blob = b));
    const get = http.expectOne({
      method: 'GET',
      url: '/api/my-profile/photo/original',
    });
    expect(get.request.responseType).toBe('blob');
    get.flush(new Blob(['jpeg'], { type: 'image/jpeg' }));
    expect(blob?.type).toBe('image/jpeg');

    service.removePhoto().subscribe();
    http
      .expectOne({ method: 'DELETE', url: '/api/my-profile/photo' })
      .flush(null, { status: 204, statusText: 'No Content' });
  });

  it('keeps the current profile, with each photo change, for the navigation', () => {
    signInAs('TRAINEE');
    service.loadCurrent();
    service.loadCurrent();
    http.expectOne('/api/my-profile').flush(profile());
    expect(service.current()?.name).toBe('Ivan Petrov');
    // Loaded once per account.
    service.loadCurrent();
    http.expectNone('/api/my-profile');

    service.uploadPhoto(new Blob(['x']), CROP).subscribe();
    http.expectOne('/api/my-profile/photo').flush(PHOTO);
    expect(service.current()?.photo).toEqual(PHOTO);

    service.removePhoto().subscribe();
    http.expectOne('/api/my-profile/photo').flush(null);
    expect(service.current()?.photo).toBeNull();
  });

  it('starts over for another account, and has nothing for admins', () => {
    signInAs('TRAINEE');
    service.loadCurrent();
    http.expectOne('/api/my-profile').flush(profile({ photo: PHOTO }));

    signInAs('ADMIN');
    service.loadCurrent();
    http.expectNone('/api/my-profile');
    expect(service.current()).toBeNull();

    signInAs('TRAINER');
    service.loadCurrent();
    http
      .expectOne('/api/my-profile')
      .flush(profile({ profileType: 'trainer', name: 'Coach Ivo' }));
    expect(service.current()?.name).toBe('Coach Ivo');
  });

  it("never keeps an answer for an account that signed out meanwhile, and loads the new one's", () => {
    signInAs('TRAINEE', { sub: 'account-a' });
    service.loadCurrent();
    const first = http.expectOne('/api/my-profile');

    // Signed out and in as someone else before the answer came.
    signInAs('TRAINER', { sub: 'account-b' });
    service.loadCurrent();
    const second = http.expectOne('/api/my-profile');

    first.flush(profile({ name: 'Ivan Petrov', photo: PHOTO }));
    expect(service.current()).toBeNull();
    second.flush(profile({ profileType: 'trainer', name: 'Coach Ivo' }));
    expect(service.current()?.name).toBe('Coach Ivo');
    expect(service.current()?.photo).toBeNull();
  });
});
