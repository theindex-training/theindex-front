import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TrainersService } from './trainers.service';

describe('TrainersService', () => {
  let service: TrainersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TrainersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists trainers with the active filter only when given', () => {
    service.list().subscribe();
    service.list(true).subscribe();

    expect(http.match(() => true).map(req => req.request.urlWithParams)).toEqual([
      '/api/trainers',
      '/api/trainers?active=true'
    ]);
  });

  it('gets, creates, updates and deactivates by id', () => {
    service.getById('tr1').subscribe();
    service.create({ name: 'Petar', nickname: null, isActive: true }).subscribe();
    service.update('tr1', { nickname: 'Pepi' }).subscribe();
    service.deactivate('tr1').subscribe();

    expect(http.match(() => true).map(req => [req.request.method, req.request.url, req.request.body])).toEqual([
      ['GET', '/api/trainers/tr1', null],
      ['POST', '/api/trainers', { name: 'Petar', nickname: null, isActive: true }],
      ['PATCH', '/api/trainers/tr1', { nickname: 'Pepi' }],
      ['DELETE', '/api/trainers/tr1', null]
    ]);
  });
});
