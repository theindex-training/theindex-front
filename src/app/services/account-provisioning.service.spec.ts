import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AccountProvisioningService } from './account-provisioning.service';

describe('AccountProvisioningService', () => {
  let service: AccountProvisioningService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccountProvisioningService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('provisions an account for a trainer or trainee profile, and manages it by account id', () => {
    const payload = {
      email: 'a@gym.test',
      role: 'TRAINER' as const,
      status: 'ACTIVE' as const,
      password: 'password1',
      confirmPassword: 'password1',
    };
    service.provisionForProfile('trainer', 'tr1', payload).subscribe();
    service
      .provisionForProfile('trainee', 't1', { ...payload, role: 'TRAINEE' })
      .subscribe();
    service.getById('acc1').subscribe();
    service.update('acc1', { email: 'b@gym.test' }).subscribe();
    service.deactivate('acc1').subscribe();

    expect(
      http
        .match(() => true)
        .map((req) => [req.request.method, req.request.url, req.request.body]),
    ).toEqual([
      ['POST', '/api/accounts/trainer/tr1', payload],
      ['POST', '/api/accounts/trainee/t1', { ...payload, role: 'TRAINEE' }],
      ['GET', '/api/accounts/acc1', null],
      ['PATCH', '/api/accounts/acc1', { email: 'b@gym.test' }],
      ['DELETE', '/api/accounts/acc1', null],
    ]);
  });
});
