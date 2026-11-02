import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TraineesService } from './trainees.service';

describe('TraineesService', () => {
  let service: TraineesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TraineesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists trainees with optional active and search params (empty search is dropped)', () => {
    service.list().subscribe();
    service.list(false).subscribe();
    service.list(true, 'ivan').subscribe();
    service.list(undefined, '').subscribe();

    expect(http.match(() => true).map(req => req.request.urlWithParams)).toEqual([
      '/api/trainees',
      '/api/trainees?active=false',
      '/api/trainees?active=true&search=ivan',
      '/api/trainees'
    ]);
  });

  it('gets, creates, updates and deactivates by id', () => {
    service.getById('t1').subscribe();
    service.create({ name: 'Ivan', isActive: true }).subscribe();
    service.update('t1', { phone: null }).subscribe();
    service.deactivate('t1').subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/trainees/t1', null],
      ['POST', '/api/trainees', { name: 'Ivan', isActive: true }],
      ['PATCH', '/api/trainees/t1', { phone: null }],
      ['DELETE', '/api/trainees/t1', null]
    ]);
  });

  it("loads the signed-in trainee's training insights", () => {
    service.getMyTrainingInsights().subscribe();

    const req = http.expectOne('/api/trainees/me/training-insights');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
