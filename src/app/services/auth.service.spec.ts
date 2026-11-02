import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { base64UrlEncode, makeToken } from '../../testing/jwt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('login', () => {
    it('posts the credentials exactly as given and stores the access token', () => {
      const token = makeToken({ sub: 'a1', role: 'ADMIN' });
      let response: unknown;

      service.login(' Admin@Gym.test ', 'secret').subscribe(value => (response = value));

      const req = http.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: ' Admin@Gym.test ', password: 'secret' });
      req.flush({ accessToken: token, account: { id: 'a1' } });

      expect(localStorage.getItem('accessToken')).toBe(token);
      expect(response).toEqual({ accessToken: token, account: { id: 'a1' } });
    });

    it('stores nothing and passes the error on when the request fails', () => {
      let status: number | undefined;

      service.login('admin', 'wrong').subscribe({ error: error => (status = error.status) });
      http
        .expectOne('/api/auth/login')
        .flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      expect(status).toBe(401);
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });

  it('logout removes only the access token and keeps the theme and language choices', () => {
    localStorage.setItem('accessToken', makeToken({ sub: 'a1' }));
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('lang', 'en');

    service.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('lang')).toBe('en');
  });

  describe('isAuthenticated', () => {
    it('is false without a token and true with one', () => {
      expect(service.isAuthenticated()).toBe(false);
      localStorage.setItem('accessToken', makeToken({ sub: 'a1' }));
      expect(service.isAuthenticated()).toBe(true);
    });

    it('accepts any stored string, including a token that cannot be decoded', () => {
      localStorage.setItem('accessToken', 'not-a-jwt');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('accepts an expired token', () => {
      const expired = makeToken({ sub: 'a1', role: 'ADMIN', exp: 1_000_000_000 }); // 2001
      localStorage.setItem('accessToken', expired);

      // CHARACTERIZATION: possibly unintended — `exp` is never checked; see TEST_NOTES.md S6.
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getUserRole()).toBe('ADMIN');
    });
  });

  describe('claims', () => {
    it('reads every claim from the stored token', () => {
      localStorage.setItem(
        'accessToken',
        makeToken({
          sub: 'account-7',
          email: 'coach@gym.test',
          role: 'TRAINER',
          trainerProfileId: 'trainer-7',
          traineeProfileId: 'trainee-7'
        })
      );

      expect(service.getAccountId()).toBe('account-7');
      expect(service.getUserEmail()).toBe('coach@gym.test');
      expect(service.getUserRole()).toBe('TRAINER');
      expect(service.getTrainerProfileId()).toBe('trainer-7');
      expect(service.getTraineeProfileId()).toBe('trainee-7');
    });

    it('returns null for every claim when there is no token', () => {
      expect(service.getAccountId()).toBeNull();
      expect(service.getUserEmail()).toBeNull();
      expect(service.getUserRole()).toBeNull();
      expect(service.getTrainerProfileId()).toBeNull();
      expect(service.getTraineeProfileId()).toBeNull();
    });

    it('returns null for missing or null claims', () => {
      localStorage.setItem(
        'accessToken',
        makeToken({ sub: 'a1', trainerProfileId: null, traineeProfileId: null })
      );

      expect(service.getUserRole()).toBeNull();
      expect(service.getTrainerProfileId()).toBeNull();
      expect(service.getTraineeProfileId()).toBeNull();
    });

    it('falls back from email to sub, then to null', () => {
      localStorage.setItem('accessToken', makeToken({ sub: 'account-9' }));
      expect(service.getUserEmail()).toBe('account-9');

      localStorage.setItem('accessToken', makeToken({ role: 'ADMIN' }));
      expect(service.getUserEmail()).toBeNull();
    });

    it.each([
      ['no payload segment', 'header-only'],
      ['invalid base64', 'header.%%%.signature'],
      ['a payload that is not JSON', `header.${base64UrlEncode('not json')}.signature`]
    ])('returns null instead of throwing for a token with %s', (_, token) => {
      localStorage.setItem('accessToken', token);

      expect(service.getUserRole()).toBeNull();
      expect(service.getAccountId()).toBeNull();
      expect(service.getUserEmail()).toBeNull();
    });

    it('decodes base64url payloads (- and _) without padding', () => {
      // "?>" encodes to "Pz4" in base64 ("+" / "/" variants appear for these bytes), so this email
      // forces both url-safe characters and a missing "=" pad into the payload segment.
      const claims = { sub: 'a1', email: 'x?>?~~~>@gym.test', role: 'ADMIN' };
      const payload = base64UrlEncode(JSON.stringify(claims));
      expect(payload).toMatch(/[-_]/);
      expect(payload.length % 4).not.toBe(0);

      localStorage.setItem('accessToken', `header.${payload}.signature`);

      expect(service.getUserEmail()).toBe('x?>?~~~>@gym.test');
      expect(service.getUserRole()).toBe('ADMIN');
    });
  });
});
