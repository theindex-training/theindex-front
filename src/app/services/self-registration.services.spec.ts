import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountsService } from './accounts.service';
import { MyProfileService } from './my-profile.service';
import { RegistrationService } from './registration.service';

describe('self-registration services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('RegistrationService', () => {
    it('posts the registration to /api/auth/register', () => {
      const payload = {
        email: 'ivan@example.com',
        password: 'my-pass-123',
        confirmPassword: 'my-pass-123',
        name: 'Ivan',
        phone: '0888123456',
        acceptTerms: true,
      };
      TestBed.inject(RegistrationService).register(payload).subscribe();

      const req = http.expectOne('/api/auth/register');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('reads the options from /api/auth/register/options', () => {
      let result: unknown;
      TestBed.inject(RegistrationService)
        .options()
        .subscribe((options) => (result = options));

      const req = http.expectOne('/api/auth/register/options');
      expect(req.request.method).toBe('GET');
      req.flush({ gyms: [], gymSubscriptions: [] });
      expect(result).toEqual({ gyms: [], gymSubscriptions: [] });
    });
  });

  describe('AccountsService', () => {
    it('lists by connection, with the search only when given', () => {
      const service = TestBed.inject(AccountsService);
      service.list('unlinked').subscribe();
      service.list('all', 'ivan').subscribe();

      const first = http.expectOne(
        (r) => r.url === '/api/accounts' && r.params.get('link') === 'unlinked',
      );
      expect(first.request.params.has('search')).toBe(false);
      first.flush([]);
      const second = http.expectOne(
        (r) => r.url === '/api/accounts' && r.params.get('link') === 'all',
      );
      expect(second.request.params.get('search')).toBe('ivan');
      second.flush([]);
    });

    it('reads, connects and deletes one account', () => {
      const service = TestBed.inject(AccountsService);
      service.details('a1').subscribe();
      http
        .expectOne({ method: 'GET', url: '/api/accounts/a1/details' })
        .flush({});

      service.link('a1', { profileType: 'trainee', name: 'Ivan' }).subscribe();
      const link = http.expectOne({
        method: 'POST',
        url: '/api/accounts/a1/link',
      });
      expect(link.request.body).toEqual({
        profileType: 'trainee',
        name: 'Ivan',
      });
      link.flush({});

      service.deletePermanently('a1').subscribe();
      http
        .expectOne({ method: 'DELETE', url: '/api/accounts/a1/permanent' })
        .flush({ id: 'a1', deleted: true });
    });
  });

  describe('MyProfileService', () => {
    it('reads and patches /api/my-profile', () => {
      const service = TestBed.inject(MyProfileService);
      service.get().subscribe();
      http.expectOne({ method: 'GET', url: '/api/my-profile' }).flush({});

      service.update({ phone: '0888123456', tiktok: null }).subscribe();
      const req = http.expectOne({ method: 'PATCH', url: '/api/my-profile' });
      expect(req.request.body).toEqual({ phone: '0888123456', tiktok: null });
      req.flush({});
    });
  });
});
