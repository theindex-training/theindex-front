import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountSecurityService } from './account-security.service';

describe('AccountSecurityService', () => {
  let service: AccountSecurityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountSecurityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each([true, false])(
    'reports whether the initial password was changed (%s)',
    (changed) => {
      let result: boolean | undefined;
      service.hasChangedPassword('acc1').subscribe((value) => (result = value));

      const req = http.expectOne('/api/accounts/acc1/password-status');
      expect(req.request.method).toBe('GET');
      req.flush({ accountId: 'acc1', hasUpdatedInitialPassword: changed });

      expect(result).toBe(changed);
    },
  );

  it('posts a password change', () => {
    const payload = {
      currentPassword: 'old-pass1',
      newPassword: 'new-pass1',
      confirmPassword: 'new-pass1',
      phone: '+359',
    };
    service.changePassword('acc1', payload).subscribe();

    const req = http.expectOne('/api/accounts/acc1/change-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });
});
