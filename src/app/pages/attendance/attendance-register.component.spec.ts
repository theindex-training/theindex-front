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
import {
  AttendanceBatchPreview,
  AttendancePreviewRow,
} from '../../services/attendance.service';
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

const paidBy = (
  subscription: Partial<NonNullable<AttendancePreviewRow['subscription']>>,
): AttendancePreviewRow['subscription'] => ({
  id: 'sub-1',
  type: 'PUNCH',
  planTitle: 'Punch 16',
  remainingCreditsAfter: null,
  endsAt: null,
  daysLeft: null,
  ...subscription,
});
const previewRow = (
  traineeId: string,
  name: string,
  level: AttendancePreviewRow['level'],
  subscription: AttendancePreviewRow['subscription'],
  nickname: string | null = null,
): AttendancePreviewRow => ({
  traineeId,
  name,
  nickname,
  paymentStatus: subscription ? 'PAID' : 'UNPAID',
  level,
  subscription,
});
const previewOf = (
  ...trainees: AttendancePreviewRow[]
): AttendanceBatchPreview => ({
  trainerId: 'trainer-1',
  locationId: 'gym-1',
  trainedAt: '2026-11-02T10:00:00.000Z',
  count: trainees.length,
  trainees,
});
const IVAN_OK = previewRow(
  't-ivan',
  'Ivan Petrov',
  'OK',
  paidBy({ remainingCreditsAfter: 9 }),
  'Vanko',
);

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

  function expectPreview() {
    const req = http.expectOne('/api/attendance/batch/preview');
    expect(req.request.method).toBe('POST');
    return req;
  }

  /** Step 1 -> 2: submits the selection and answers the preview; returns what was asked. */
  async function review(preview = previewOf(IVAN_OK)) {
    await page.submit();
    const req = expectPreview();
    req.flush(preview);
    await page.settle();
    return req.request.body as unknown;
  }

  const summary = () => page.query('[data-testid="attendance-summary"]');
  /** Per summary row: name, note and the figure in the chip. */
  const summaryRows = () =>
    page
      .queryAll('[data-testid="attendance-summary-row"]')
      .map((row) =>
        ['.record__title', '.record__meta', '.chip']
          .map((part) => row.querySelector(part)!.textContent.trim())
          .join(' | '),
      );

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

      http.expectNone('/api/attendance/batch/preview');
      http.expectNone('/api/attendance/batch');
      expect(page.alert()).toBe(copy.selectAtLeastOne);
      expect(summary()).toBeNull();
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

    it('asks for a preview of the selection first, with the time as HH:mm, and saves nothing yet', async () => {
      await page.select('select[formcontrolname="locationId"]', 'gym-2');
      await page.select('select[formcontrolname="trainedTime"]', '08:00');
      await tick('Ivan Petrov');
      await search('gosho');
      await tick('Georgi Dimitrov');

      const asked = await review();

      expect(asked).toEqual({
        trainerId: 'trainer-1',
        locationId: 'gym-2',
        traineeIds: ['t-ivan', 't-georgi'],
        trainedDate: '2026-11-02',
        trainedTime: '08:00',
      });
      http.expectNone('/api/attendance/batch');
      expect(summary()).not.toBeNull();
      expect(router.url).toBe('/attendance/new');
    });

    it('saves exactly what was reviewed, then goes to the attendance list', async () => {
      await page.select('select[formcontrolname="locationId"]', 'gym-2');
      await page.select('select[formcontrolname="trainedTime"]', '08:00');
      await tick('Ivan Petrov');
      await tick('Georgi Dimitrov');
      const asked = await review();
      await page.submit();

      const req = expectBatch();
      expect(req.request.body).toEqual(asked);
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
      const asked = await review();
      await page.submit();

      const body = expectBatch().request.body;
      expect(asked).toEqual(body);
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
      await review();
      await page.submit();

      expect(expectBatch().request.body.traineeIds).toEqual(['t-ivelina']);
    });

    describe('the summary', () => {
      it('shows the session and, per trainee in the API order, what is left after this training', async () => {
        await page.select('select[formcontrolname="trainedTime"]', '18:30');
        await tick('Ivan Petrov');
        await review(
          previewOf(
            previewRow('t-1', 'Dan Unpaid', 'UNPAID', null),
            previewRow(
              't-2',
              'Bob Last',
              'LAST',
              paidBy({ planTitle: 'Punch 8', remainingCreditsAfter: 0 }),
            ),
            previewRow(
              't-3',
              'Eve Today',
              'LAST',
              paidBy({
                type: 'TIME',
                planTitle: 'Month',
                endsAt: '2026-11-02T20:00:00.000Z',
                daysLeft: 0,
              }),
            ),
            previewRow(
              't-4',
              'Lea Low',
              'LOW',
              paidBy({ remainingCreditsAfter: 1 }),
            ),
            previewRow(
              't-5',
              'Tim Week',
              'LOW',
              paidBy({
                type: 'TIME',
                planTitle: 'Month',
                endsAt: '2026-11-05T10:00:00.000Z',
                daysLeft: 3,
              }),
            ),
            IVAN_OK,
            previewRow(
              't-6',
              'Zoe Month',
              'OK',
              paidBy({
                type: 'TIME',
                planTitle: 'Quarter',
                endsAt: '2026-12-20T10:00:00.000Z',
                daysLeft: 48,
              }),
            ),
          ),
        );

        expect(
          page
            .queryAll('[data-testid="attendance-summary-session"] dd')
            .map((item) => item.textContent.trim()),
        ).toEqual(['Petar', 'Center', '2 Nov 2026', '18:30']);
        expect(summaryRows()).toEqual([
          `Dan Unpaid | ${copy.summary.noSubscription} | ${copy.summary.unpaid}`,
          `Bob Last | Punch 8 | ${copy.summary.lastTraining}`,
          'Eve Today | Month · Ends 2 Nov 2026 | Ends today',
          'Lea Low | Punch 16 | 1 left',
          'Tim Week | Month · Ends 5 Nov 2026 | 3 days left',
          'Ivan Petrov (Vanko) | Punch 16 | 9 left',
          'Zoe Month | Quarter · Ends 20 Dec 2026 | 48 days left',
        ]);
        expect(
          page
            .query('[data-testid="attendance-summary-count"]')!
            .textContent.replace(/\s+/g, ' ')
            .trim(),
        ).toBe('7 trainees · 5 near the end or unpaid');
      });

      it('colours the figure by how close the end is', async () => {
        await tick('Ivan Petrov');
        await review(
          previewOf(
            previewRow('t-1', 'Dan Unpaid', 'UNPAID', null),
            previewRow(
              't-2',
              'Bob Last',
              'LAST',
              paidBy({ remainingCreditsAfter: 0 }),
            ),
            previewRow(
              't-4',
              'Lea Low',
              'LOW',
              paidBy({ remainingCreditsAfter: 2 }),
            ),
            IVAN_OK,
          ),
        );

        expect(
          page
            .queryAll('[data-testid="attendance-summary-row"] .chip')
            .map((chip) =>
              Array.from(chip.classList).find((name) =>
                name.startsWith('chip--'),
              ),
            ),
        ).toEqual([
          'chip--danger',
          'chip--warning',
          'chip--warning',
          'chip--neutral',
        ]);
      });

      it('says when no one is near the end, and "Not specified" without a time', async () => {
        await tick('Ivan Petrov');
        await review();

        expect(
          page
            .query('[data-testid="attendance-summary-count"]')!
            .textContent.replace(/\s+/g, ' ')
            .trim(),
        ).toBe('1 trainee · Everyone has paid trainings left');
        expect(
          page
            .queryAll('[data-testid="attendance-summary-session"] dd')
            .at(-1)!
            .textContent.trim(),
        ).toBe(copy.notSpecified);
      });

      it('moves focus to the summary heading', async () => {
        document.body.appendChild(fixture.nativeElement);
        await tick('Ivan Petrov');
        await review();

        expect(document.activeElement?.textContent.trim()).toBe(
          copy.summary.title,
        );
        fixture.nativeElement.remove();
      });

      it('"Back" returns to the selection as it was; a changed selection is previewed again', async () => {
        await page.select('select[formcontrolname="trainedTime"]', '08:00');
        await tick('Ivan Petrov');
        await review();
        expect(shownTrainees()).toEqual([]);

        await clickButton(copy.summary.back);

        expect(summary()).toBeNull();
        http.expectNone('/api/attendance/batch');
        expect(checkbox('Ivan Petrov').checked).toBe(true);
        expect(select('trainedTime').value).toBe('08:00');

        await tick('Ivelina Koleva');
        const asked = await review();
        await page.submit();

        expect(asked).toMatchObject({ traineeIds: ['t-ivan', 't-ivelina'] });
        expect(expectBatch().request.body.traineeIds).toEqual([
          't-ivan',
          't-ivelina',
        ]);
      });

      it('shows the API error when the preview fails and stays on the selection', async () => {
        await tick('Ivan Petrov');
        await page.submit();
        const error = apiError('Some trainees are missing or inactive');
        expectPreview().flush(error.body, error.options);
        await page.settle();

        expect(page.alert()).toBe('Some trainees are missing or inactive');
        expect(summary()).toBeNull();
        expect(checkbox('Ivan Petrov').checked).toBe(true);
      });

      it('falls back to its own message when the preview fails without one', async () => {
        await tick('Ivan Petrov');
        await page.submit();
        const error = apiError(undefined, 500);
        expectPreview().flush(error.body, error.options);
        await page.settle();

        expect(page.alert()).toBe(copy.previewError);
      });
    });

    it('shows the API error when saving fails and keeps the summary and the selection', async () => {
      await tick('Ivan Petrov');
      await review();
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
      expect(summary()).not.toBeNull();
      expect(router.url).toBe('/attendance/new');

      await clickButton(copy.summary.back);
      expect(page.alert()).toBeUndefined();
      expect(checkbox('Ivan Petrov').checked).toBe(true);
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

    http.expectNone('/api/attendance/batch/preview');
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
