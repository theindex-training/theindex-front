import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  SubscriptionRenewals,
  SubscriptionRenewalsService,
} from './subscription-renewals.service';

describe('SubscriptionRenewalsService', () => {
  let service: SubscriptionRenewalsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubscriptionRenewalsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GETs /api/subscription-renewals and passes the answer through', () => {
    const body: SubscriptionRenewals = {
      punch: { exhausted: [], active: [] },
      time: { exhausted: [], active: [] },
    };
    let result: SubscriptionRenewals | undefined;

    service.overview().subscribe((value) => (result = value));
    const req = http.expectOne('/api/subscription-renewals');
    req.flush(body);

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    expect(result).toEqual(body);
  });
});
