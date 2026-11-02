import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlansService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists plans, with the active filter only when given', () => {
    service.list().subscribe();
    service.list(true).subscribe();
    service.list(false).subscribe();

    http.expectOne(req => req.method === 'GET' && req.urlWithParams === '/api/plans').flush([]);
    http.expectOne('/api/plans?active=true').flush([]);
    http.expectOne('/api/plans?active=false').flush([]);
  });

  it('gets, creates, updates and deactivates by id', () => {
    service.getById('p1').subscribe();
    service.create({ type: 'PUNCH', title: 'T', priceCents: 100, credits: 5 }).subscribe();
    service.update('p1', { title: 'U', credits: null }).subscribe();
    service.deactivate('p1').subscribe();

    const requests = http.match(() => true);
    expect(requests.map(req => [req.request.method, req.request.urlWithParams, req.request.body])).toEqual([
      ['GET', '/api/plans/p1', null],
      ['POST', '/api/plans', { type: 'PUNCH', title: 'T', priceCents: 100, credits: 5 }],
      ['PATCH', '/api/plans/p1', { title: 'U', credits: null }],
      ['DELETE', '/api/plans/p1', null]
    ]);
  });
});
