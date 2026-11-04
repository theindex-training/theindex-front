import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SettlementsService } from './settlements.service';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettlementsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const sent = () =>
    http
      .match(() => true)
      .map((req) => [
        req.request.method,
        req.request.urlWithParams,
        req.request.body,
      ]);

  it('lists, generates, gets, finalizes and deletes settlements', () => {
    service.list().subscribe();
    service
      .generate({ periodStart: '2026-10-01', periodEnd: '2026-10-31' })
      .subscribe();
    service.getById('s1').subscribe();
    service.finalize('s1').subscribe();
    service.delete('s1').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/settlements', null],
      [
        'POST',
        '/api/settlements',
        { periodStart: '2026-10-01', periodEnd: '2026-10-31' },
      ],
      ['GET', '/api/settlements/s1', null],
      ['POST', '/api/settlements/s1/finalize', {}],
      ['DELETE', '/api/settlements/s1', null],
    ]);
  });

  it('pages allocations, with the trainer filter only when given', () => {
    service.allocations('s1', { offset: 0, limit: 500 }).subscribe();
    service
      .allocations('s1', { trainerId: 'tr1', offset: 500, limit: 500 })
      .subscribe();

    expect(sent().map(([, url]) => url)).toEqual([
      '/api/settlements/s1/allocations?offset=0&limit=500',
      '/api/settlements/s1/allocations?trainerId=tr1&offset=500&limit=500',
    ]);
  });
});
