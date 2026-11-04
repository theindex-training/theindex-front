import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { GymLocation } from '../../services/gym-locations.service';
import { TraineeProfile } from '../../services/trainees.service';
import { TrainerProfile } from '../../services/trainers.service';
import { TrainingTime } from '../../services/training-times.service';
import { AttendanceRegisterComponent } from './attendance-register.component';

const copy = en.attendance.register;

const trainer = (
  id: string,
  name: string,
  isActive = true,
): TrainerProfile => ({
  id,
  name,
  nickname: null,
  accountId: null,
  isActive,
});
const gym = (id: string, name: string, isActive = true): GymLocation => ({
  id,
  name,
  address: null,
  notes: null,
  isActive,
});
const trainee = (
  id: string,
  name: string,
  nickname: string | null,
  isActive = true,
): TraineeProfile => ({
  id,
  name,
  nickname,
  phone: null,
  accountId: null,
  gymSubscriptionId: null,
  isActive,
});

const TRAINERS = [
  trainer('trainer-other', 'Maria'),
  trainer('trainer-1', 'Petar'),
  trainer('trainer-old', 'Old', false),
];
const GYMS = [
  gym('gym-closed', 'Closed', false),
  gym('gym-1', 'Center'),
  gym('gym-2', 'South'),
];
const TIMES: TrainingTime[] = [
  { id: 'tt-evening', startTime: '18:30:00', endTime: '19:30:00' },
  { id: 'tt-morning', startTime: '8:00:00', endTime: '9:00:00' },
];
const TRAINEES = [
  trainee('t-ivan', 'Ivan Petrov', 'Vanko'),
  trainee('t-ivelina', 'Ivelina Koleva', null),
  trainee('t-georgi', 'Georgi Dimitrov', 'Gosho'),
  trainee('t-gone', 'Ivo Gone', null, false),
];

describe('AttendanceRegisterComponent', () => {
  let fixture: ComponentFixture<AttendanceRegisterComponent>;
  let http: HttpTestingController;
  let router: Router;
  let page: PageDriver;

  beforeEach(async () => {
    // 00:30 on 2 Nov in Sofia (still 1 Nov in UTC). Only Date is faked.
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-01T22:30:00Z'),
    });
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AttendanceRegisterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl('/attendance/new');
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  async function render(load: 'ok' | 'error' = 'ok', trainers = TRAINERS) {
    fixture = TestBed.createComponent(AttendanceRegisterComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    const requests = [
      http.expectOne('/api/trainers?active=true'),
      http.expectOne('/api/gym-locations?includeInactive=false'),
      http.expectOne('/api/training-times'),
      http.expectOne('/api/trainees?active=true'),
    ];
    if (load === 'error') {
      const error = apiError(undefined, 500);
      requests[0].flush(error.body, error.options);
    } else {
      [trainers, GYMS, TIMES, TRAINEES].forEach((body, index) =>
        requests[index].flush(body),
      );
    }
    await page.settle();
  }

  const select = (name: string) =>
    page.query<HTMLSelectElement>(`select[formcontrolname="${name}"]`)!;
  const shownTrainees = () =>
    page
      .queryAll('label')
      .filter((label) => label.querySelector('input[type="checkbox"]'))
      .map((label) => label.textContent.replace(/\s+/g, ' ').trim());
  const checkbox = (name: string) =>
    page
      .queryAll('label')
      .find((label) => label.textContent?.includes(name))!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;

  async function tick(name: string) {
    checkbox(name).click();
    await page.settle();
  }

  async function search(term: string) {
    await page.type('input[type="search"]', term);
  }

  async function clickButton(label: string) {
    page
      .queryAll('button')
      .find((button) => button.textContent?.trim() === label)!
      .click();
    await page.settle();
  }

  function expectBatch() {
    const req = http.expectOne('/api/attendance/batch');
    expect(req.request.method).toBe('POST');
    return req;
  }

  describe('as a trainer', () => {
    beforeEach(async () => {
      signInAs('TRAINER', { trainerProfileId: 'trainer-1' });
      await render();
    });

    it('preselects the signed-in trainer, the first active gym and the local date', () => {
      expect(select('trainerId').value).toBe('trainer-1');
      expect(select('locationId').value).toBe('gym-1');
      expect(page.query<HTMLInputElement>('input[type="date"]')!.value).toBe(
        '2026-11-02',
      );
    });

    it('lists only active trainers, gyms and trainees, and training times by start time', () => {
      const options = (name: string) =>
        Array.from(select(name).options).map((option) => option.value);

      expect(options('trainerId')).toEqual(['', 'trainer-other', 'trainer-1']);
      expect(options('locationId')).toEqual(['', 'gym-1', 'gym-2']);
      expect(options('trainedTime')).toEqual(['', '08:00', '18:30']);
      expect(
        Array.from(select('trainedTime').options).map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual([copy.notSpecified, '08:00 - 09:00', '18:30 - 19:30']);
      const shown = shownTrainees();
      expect(shown.length).toBe(3);
      ['Ivan Petrov', 'Ivelina Koleva', 'Georgi Dimitrov'].forEach(
        (name, index) => expect(shown[index]).toContain(name),
      );
    });

    it('requires at least one trainee', async () => {
      await page.submit();

      http.expectNone('/api/attendance/batch');
      expect(page.alert()).toBe(copy.selectAtLeastOne);
    });

    it('searches names and nicknames, case-insensitively', async () => {
      await search('IV');
      expect(shownTrainees().length).toBe(2);

      await search(' gosho ');
      expect(shownTrainees().length).toBe(1);
      expect(shownTrainees()[0]).toContain('Georgi Dimitrov');

      await search('nobody');
      expect(page.text()).toContain(copy.noMatches);
    });

    it('"Select shown" and "Clear shown" only touch the trainees that match the search', async () => {
      await tick('Georgi Dimitrov');
      await search('iv');
      await clickButton(copy.selectShown);
      await search('');

      expect(checkbox('Ivan Petrov').checked).toBe(true);
      expect(checkbox('Ivelina Koleva').checked).toBe(true);
      expect(checkbox('Georgi Dimitrov').checked).toBe(true);

      await search('ivelina');
      await clickButton(copy.clearShown);
      await search('');

      expect(checkbox('Ivan Petrov').checked).toBe(true);
      expect(checkbox('Ivelina Koleva').checked).toBe(false);
      expect(checkbox('Georgi Dimitrov').checked).toBe(true);
    });

    it('registers the selected trainees for the session, with the time as HH:mm', async () => {
      await page.select('select[formcontrolname="locationId"]', 'gym-2');
      await page.select('select[formcontrolname="trainedTime"]', '08:00');
      await tick('Ivan Petrov');
      await search('gosho');
      await tick('Georgi Dimitrov');
      await page.submit();

      const req = expectBatch();
      expect(req.request.body).toEqual({
        trainerId: 'trainer-1',
        locationId: 'gym-2',
        traineeIds: ['t-ivan', 't-georgi'],
        trainedDate: '2026-11-02',
        trainedTime: '08:00',
      });
      req.flush({
        trainerId: 'trainer-1',
        trainedAt: '2026-11-02T06:00:00Z',
        count: 2,
        results: [],
      });
      await page.settle();

      expect(router.url).toBe('/attendance');
    });

    it('leaves the time out when none is picked', async () => {
      await tick('Ivelina Koleva');
      await page.submit();

      const body = expectBatch().request.body;
      expect(body).toEqual({
        trainerId: 'trainer-1',
        locationId: 'gym-1',
        traineeIds: ['t-ivelina'],
        trainedDate: '2026-11-02',
      });
      expect('trainedTime' in body).toBe(false);
    });

    it('unticking a trainee removes them from the batch', async () => {
      await tick('Ivan Petrov');
      await tick('Ivelina Koleva');
      await tick('Ivan Petrov');
      await page.submit();

      expect(expectBatch().request.body.traineeIds).toEqual(['t-ivelina']);
    });

    it('shows the API error and keeps the selection', async () => {
      await tick('Ivan Petrov');
      await page.submit();
      const error = apiError([
        'trainedDate must not be in the future',
        'trainee t-ivan is inactive',
      ]);
      expectBatch().flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe(
        'trainedDate must not be in the future, trainee t-ivan is inactive',
      );
      expect(checkbox('Ivan Petrov').checked).toBe(true);
      expect(router.url).toBe('/attendance/new');
    });
  });

  it('preselects the first trainer for an admin without a trainer profile', async () => {
    signInAs('ADMIN');
    await render();

    expect(select('trainerId').value).toBe('trainer-other');
  });

  it('preselects the first trainer when the signed-in trainer is not in the active list', async () => {
    signInAs('TRAINER', { trainerProfileId: 'trainer-old' });
    await render();

    expect(select('trainerId').value).toBe('trainer-other');
  });

  it('sends nothing while a required session field is empty', async () => {
    signInAs('ADMIN');
    await render('ok', []);
    await tick('Ivan Petrov');
    await page.submit();

    http.expectNone('/api/attendance/batch');
    expect(select('trainerId').value).toBe('');
    expect(page.text()).toContain(copy.trainerRequired);
  });

  it('shows a load error when any of the lists fails', async () => {
    signInAs('TRAINER');
    await render('error');

    expect(page.alert()).toBe(copy.loadError);
  });
});
