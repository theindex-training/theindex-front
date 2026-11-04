import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttendanceService);
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

  it('registers a batch', () => {
    const payload = {
      trainerId: 'tr1',
      traineeIds: ['a', 'b'],
      locationId: 'g1',
      trainedDate: '2026-11-02',
    };
    service.createBatch(payload).subscribe();

    expect(sent()).toEqual([['POST', '/api/attendance/batch', payload]]);
  });

  it('queries sessions, dropping the optional filters that are not set', () => {
    service
      .sessions({ startDate: '2026-10-01', endDate: '2026-10-31' })
      .subscribe();
    service
      .sessions({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        startTime: '18:00',
        endTime: '20:00',
        trainerId: 'tr1',
      })
      .subscribe();
    service
      .sessions({
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        startTime: '',
        trainerId: undefined,
      })
      .subscribe();

    expect(sent().map(([, url]) => url)).toEqual([
      '/api/attendance/sessions?startDate=2026-10-01&endDate=2026-10-31',
      '/api/attendance/sessions?startDate=2026-10-01&endDate=2026-10-31&startTime=18:00&endTime=20:00&trainerId=tr1',
      '/api/attendance/sessions?startDate=2026-10-01&endDate=2026-10-31',
    ]);
  });

  it("deletes one attendance and lists a trainee's trainings (all, paid, unpaid)", () => {
    service.deleteById('a1').subscribe();
    service.listForTrainee('t1').subscribe();
    service.listPaidForTrainee('t1').subscribe();
    service.listUnpaidForTrainee('t1').subscribe();

    expect(sent()).toEqual([
      ['DELETE', '/api/attendance/a1', null],
      ['GET', '/api/attendance/trainees/t1', null],
      ['GET', '/api/attendance/trainees/t1/paid', null],
      ['GET', '/api/attendance/trainees/t1/unpaid', null],
    ]);
  });

  it('loads the two dashboard reports', () => {
    service.getInactiveTraineesReport({ skipDays: 30 }).subscribe();
    service.getTraineesWithoutActiveSubscriptionReport().subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/attendance/reports/inactive-trainees?skipDays=30', null],
      ['GET', '/api/attendance/reports/without-active-subscription', null],
    ]);
  });
});
