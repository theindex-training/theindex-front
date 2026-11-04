import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TrainingTimesService } from './training-times.service';

describe('TrainingTimesService', () => {
  let service: TrainingTimesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrainingTimesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, gets, creates, updates and deletes training times', () => {
    service.list().subscribe();
    service.getById('tt1').subscribe();
    service.create({ startTime: '18:00', endTime: '19:00' }).subscribe();
    service.update('tt1', { endTime: '19:30' }).subscribe();
    let deleted: unknown;
    service.delete('tt1').subscribe((result) => (deleted = result));

    const requests = http.match(() => true);
    expect(
      requests.map((req) => [
        req.request.method,
        req.request.urlWithParams,
        req.request.body,
      ]),
    ).toEqual([
      ['GET', '/api/training-times', null],
      ['GET', '/api/training-times/tt1', null],
      ['POST', '/api/training-times', { startTime: '18:00', endTime: '19:00' }],
      ['PATCH', '/api/training-times/tt1', { endTime: '19:30' }],
      ['DELETE', '/api/training-times/tt1', null],
    ]);
    requests[4].flush({ deleted: true });
    expect(deleted).toEqual({ deleted: true });
  });
});
