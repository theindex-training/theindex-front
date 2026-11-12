import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExercisesService } from './exercises.service';
import { WorkoutPayload, WorkoutsService } from './workouts.service';

/** The services of the workouts area: the requests they send. */
describe('workouts and exercises services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
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

  it('ExercisesService: list with filters, get, create, update, delete', () => {
    const service = TestBed.inject(ExercisesService);
    const payload = { name: 'Pull-up' };

    service.list().subscribe();
    service.list({ active: false, q: 'swing' }).subscribe();
    service.list({ active: true, q: '' }).subscribe();
    service.getById('e1').subscribe();
    service.create(payload).subscribe();
    service.update('e1', { isActive: false }).subscribe();
    service.delete('e1').subscribe();
    service.addAlias('e1', 'KB swing').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/exercises', null],
      ['GET', '/api/exercises?active=false&q=swing', null],
      ['GET', '/api/exercises?active=true', null],
      ['GET', '/api/exercises/e1', null],
      ['POST', '/api/exercises', payload],
      ['PATCH', '/api/exercises/e1', { isActive: false }],
      ['DELETE', '/api/exercises/e1', null],
      ['POST', '/api/exercises/e1/aliases', { alias: 'KB swing' }],
    ]);
  });

  it('WorkoutsService: list by range, get, create, update, delete', () => {
    const service = TestBed.inject(WorkoutsService);
    const payload: WorkoutPayload = {
      date: '2026-11-09',
      title: 'Helen',
      summary: '3 rounds for time:\n400-m run',
      exerciseIds: ['e1'],
      sourcePdfId: 'pdf-1',
    };

    service.list().subscribe();
    service.list({ from: '2026-11-09', to: '2026-11-15' }).subscribe();
    service.getById('w1').subscribe();
    service.create(payload).subscribe();
    service.update('w1', payload).subscribe();
    service.delete('w1').subscribe();

    expect(sent()).toEqual([
      ['GET', '/api/workouts', null],
      ['GET', '/api/workouts?from=2026-11-09&to=2026-11-15', null],
      ['GET', '/api/workouts/w1', null],
      ['POST', '/api/workouts', payload],
      ['PATCH', '/api/workouts/w1', payload],
      ['DELETE', '/api/workouts/w1', null],
    ]);
  });

  it('WorkoutsService: uploads the PDF as multipart form data', () => {
    const file = new File(['%PDF-1.4'], '261109.pdf', {
      type: 'application/pdf',
    });

    TestBed.inject(WorkoutsService).importPdf(file).subscribe();

    const req = http.expectOne('/api/workouts/import-pdf');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('261109.pdf');
  });

  it('WorkoutsService: fetches a kept PDF as a blob, by its id', () => {
    let received: Blob | undefined;
    TestBed.inject(WorkoutsService)
      .sourcePdf('pdf-1')
      .subscribe((blob) => (received = blob));

    const req = http.expectOne('/api/workouts/source-pdfs/pdf-1');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    req.flush(pdf);
    expect(received).toBe(pdf);
  });
});
