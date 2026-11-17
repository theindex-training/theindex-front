import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { makeToken, signInAs } from '../../testing/jwt';
import { AccountSetupService } from './account-setup.service';
import { AuthService } from './auth.service';

describe('AccountSetupService', () => {
  let service: AccountSetupService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountSetupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the prefilled form from GET /api/account-setup', () => {
    service.get().subscribe();
    expect(http.expectOne('/api/account-setup').request.method).toBe('GET');
  });

  it('posts the form and signs in with the answered token, which no longer requires the setup', () => {
    signInAs('TRAINEE', { setupRequired: true });
    const auth = TestBed.inject(AuthService);
    expect(auth.isSetupRequired()).toBe(true);

    const payload = {
      email: 'ivan@example.com',
      name: 'Ivan',
      password: 'new-pass-1',
      confirmPassword: 'new-pass-1',
      phone: '0888123456',
      homeGymId: null,
      instagram: null,
      facebook: null,
      tiktok: null,
      acceptTerms: true,
    };
    service.complete(payload).subscribe();

    const req = http.expectOne('/api/account-setup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    const token = makeToken({
      sub: 'account-trainee',
      role: 'TRAINEE',
      setupRequired: false,
    });
    req.flush({ accessToken: token, account: {} });

    expect(auth.getToken()).toBe(token);
    expect(auth.isSetupRequired()).toBe(false);
  });

  it('keeps the old token when the save fails', () => {
    const before = signInAs('TRAINEE', { setupRequired: true });
    service.complete({} as never).subscribe({ error: () => undefined });
    http
      .expectOne('/api/account-setup')
      .flush(null, { status: 400, statusText: 'Bad Request' });

    expect(TestBed.inject(AuthService).getToken()).toBe(before);
  });
});
