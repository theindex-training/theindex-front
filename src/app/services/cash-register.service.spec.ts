import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  let service: CashRegisterService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CashRegisterService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the current state and posts manual transactions', () => {
    service.getCurrentState().subscribe();
    service.createManualTransaction({ direction: 'OUT', amountCents: 1234, notes: 'float' }).subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/cash-register', null],
      ['POST', '/api/cash-register/transactions/manual', { direction: 'OUT', amountCents: 1234, notes: 'float' }]
    ]);
  });
});
