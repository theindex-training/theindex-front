import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GymLocationsService } from './gym-locations.service';

describe('GymLocationsService', () => {
  let service: GymLocationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GymLocationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists gyms, sending includeInactive (true or false) only when given', () => {
    service.list().subscribe();
    service.list(true).subscribe();
    service.list(false).subscribe();

    expect(http.match(() => true).map(req => req.request.urlWithParams)).toEqual([
      '/api/gym-locations',
      '/api/gym-locations?includeInactive=true',
      '/api/gym-locations?includeInactive=false'
    ]);
  });

  it('gets, creates, updates and deactivates by id', () => {
    service.getById('g1').subscribe();
    service.create({ name: 'Center', address: null }).subscribe();
    service.update('g1', { name: 'South' }).subscribe();
    service.deactivate('g1').subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/gym-locations/g1', null],
      ['POST', '/api/gym-locations', { name: 'Center', address: null }],
      ['PATCH', '/api/gym-locations/g1', { name: 'South' }],
      ['DELETE', '/api/gym-locations/g1', null]
    ]);
  });
});
