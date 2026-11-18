import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BenchmarksService } from './benchmarks.service';

describe('BenchmarksService', () => {
  let service: BenchmarksService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BenchmarksService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const sent = () =>
    http
      .match(() => true)
      .map((req) => {
        req.flush({});
        return [
          req.request.method,
          req.request.urlWithParams,
          req.request.body,
        ];
      });

  it('reads and changes the catalogue', () => {
    service.list().subscribe();
    service.list({ kind: 'LIFT', active: true }).subscribe();
    service.getById('b1').subscribe();
    service
      .create({ kind: 'LIFT', name: 'Deadlift', exerciseIds: ['e1'] })
      .subscribe();
    service.update('b1', { timeCapSeconds: null }).subscribe();
    service.delete('b1').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/benchmarks', null],
      ['GET', '/api/benchmarks?kind=LIFT&active=true', null],
      ['GET', '/api/benchmarks/b1', null],
      [
        'POST',
        '/api/benchmarks',
        { kind: 'LIFT', name: 'Deadlift', exerciseIds: ['e1'] },
      ],
      ['PATCH', '/api/benchmarks/b1', { timeCapSeconds: null }],
      ['DELETE', '/api/benchmarks/b1', null],
    ]);
  });

  it('reads the leaderboards: one benchmark, and the records page by kind', () => {
    service.leaderboard('b1').subscribe();
    service.overview('BENCHMARK').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/benchmarks/b1/leaderboard', null],
      ['GET', '/api/leaderboards?kind=BENCHMARK', null],
    ]);
  });

  it("reads, logs, changes and deletes the person's own results", () => {
    const result = {
      performedOn: '2026-06-20',
      scaled: false,
      timeSeconds: 266,
      capped: false,
      rounds: null,
      reps: null,
      loadKg: null,
      note: null,
    };
    service.myResults().subscribe();
    service.myResults('b1').subscribe();
    service.getResult('r1').subscribe();
    service.createResult({ benchmarkId: 'b1', ...result }).subscribe();
    service.updateResult('r1', { note: 'x' }).subscribe();
    service.deleteResult('r1').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/benchmark-results/mine', null],
      ['GET', '/api/benchmark-results/mine?benchmarkId=b1', null],
      ['GET', '/api/benchmark-results/r1', null],
      ['POST', '/api/benchmark-results', { benchmarkId: 'b1', ...result }],
      ['PATCH', '/api/benchmark-results/r1', { note: 'x' }],
      ['DELETE', '/api/benchmark-results/r1', null],
    ]);
  });
});
