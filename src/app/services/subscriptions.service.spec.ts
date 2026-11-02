import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SubscriptionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("lists and sells subscriptions under the trainee, and deletes them by their own id", () => {
    service.listForTrainee('t1').subscribe();
    service.createForTrainee('t1', { planId: 'p1', startsAt: '2026-11-02', paidCents: 4550 }).subscribe();
    service.delete('s1').subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/trainees/t1/subscriptions', null],
      ['POST', '/api/trainees/t1/subscriptions', { planId: 'p1', startsAt: '2026-11-02', paidCents: 4550 }],
      ['DELETE', '/api/subscriptions/s1', null]
    ]);
  });
});
