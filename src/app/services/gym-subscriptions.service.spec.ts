import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GymSubscriptionsService } from './gym-subscriptions.service';

describe('GymSubscriptionsService', () => {
  let service: GymSubscriptionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GymSubscriptionsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists gym cards, sending includeInactive only when given', () => {
    service.list().subscribe();
    service.list(true).subscribe();
    service.list(false).subscribe();

    expect(http.match(() => true).map(req => req.request.urlWithParams)).toEqual([
      '/api/gym-subscriptions',
      '/api/gym-subscriptions?includeInactive=true',
      '/api/gym-subscriptions?includeInactive=false'
    ]);
  });

  it('gets, creates, updates and deactivates by id', () => {
    service.getById('gs1').subscribe();
    service.create({ name: 'Card' }).subscribe();
    service.update('gs1', { name: 'New card' }).subscribe();
    service.deactivate('gs1').subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/gym-subscriptions/gs1', null],
      ['POST', '/api/gym-subscriptions', { name: 'Card' }],
      ['PATCH', '/api/gym-subscriptions/gs1', { name: 'New card' }],
      ['DELETE', '/api/gym-subscriptions/gs1', null]
    ]);
  });
});
