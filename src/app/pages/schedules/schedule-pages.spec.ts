import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { GymDetailsComponent } from '../gyms/gym-details.component';
import { ScheduleTemplateComponent } from './schedule-template.component';
import { SCHEDULE_GYM_KEY } from './schedule-gym';
import { SchedulesComponent } from './schedules.component';

/** The gym's weekly template (ADMIN) and the Schedule tab (ADMIN, TRAINER). */

const texts = en.schedules;

const GYMS = [
  { id: 'gym-c', name: 'Center', address: null, notes: null, isActive: true },
  { id: 'gym-n', name: 'North', address: null, notes: null, isActive: true },
  { id: 'gym-o', name: 'Old', address: null, notes: null, isActive: false },
];
const MORNING = {
  id: 'tt-morning',
  startTime: '07:10:00',
  endTime: '08:10:00',
};
const EVENING = {
  id: 'tt-evening',
  startTime: '17:00:00',
  endTime: '18:00:00',
};
const TIMES = [EVENING, MORNING];
const trainer = (id: string, name: string, isActive = true) => ({
  id,
  name,
  nickname: null,
  isActive,
});
const VELCHO = trainer('tr-velcho', 'Velcho Sokolov');
const VASKO = trainer('tr-vasko', 'Vasko');
const TRAINERS = [
  { ...VELCHO, accountId: null },
  { ...VASKO, accountId: null },
];

const templateSlot = (
  id: string,
  weekday: number,
  time: typeof MORNING,
  by: typeof VELCHO,
) => ({ id, weekday, trainingTime: time, trainer: by });
const TEMPLATE = {
  gym: { id: 'gym-c', name: 'Center' },
  slots: [
    templateSlot('ts-1', 1, MORNING, VELCHO),
    templateSlot('ts-2', 1, EVENING, VASKO),
    templateSlot('ts-3', 3, MORNING, VELCHO),
  ],
};

const weekSlot = (
  id: string,
  date: string,
  time: typeof MORNING,
  by: typeof VELCHO,
  workout: { id: string; title: string | null } | null = null,
) => ({
  id,
  date,
  weekday: 0,
  trainingTime: time,
  trainer: by,
  workout,
  bookedCount: 0,
});
/** The week of 9-15 Nov 2026, seen on Friday 13 Nov: the 14th is the first editable day. */
const WEEK = {
  gym: { id: 'gym-c', name: 'Center' },
  weekStart: '2026-11-09',
  weekEnd: '2026-11-15',
  editableFrom: '2026-11-14',
  week: {
    id: 'week-1',
    createdAt: '2026-11-08T10:00:00Z',
    status: 'PUBLISHED',
    publishedAt: '2026-11-08T11:00:00Z',
  },
  slots: [
    weekSlot('s-thu', '2026-11-12', MORNING, VELCHO),
    weekSlot('s-fri', '2026-11-13', EVENING, VASKO),
    weekSlot('s-sat', '2026-11-14', MORNING, VELCHO, {
      id: 'w-sat',
      title: 'Helen',
    }),
  ],
};
const NOT_CREATED = { ...WEEK, week: null, slots: [] };
/** The same week as created from the template, before anyone published it. */
const DRAFT = {
  ...WEEK,
  week: { ...WEEK.week, status: 'DRAFT', publishedAt: null },
};
const WORKOUT_SAT = {
  id: 'w-sat',
  date: '2026-11-14',
  title: 'Helen',
  summary: 'Run',
  exercises: [],
  sourcePdf: null,
};
const WORKOUT_SAT_2 = {
  ...WORKOUT_SAT,
  id: 'w-sat-2',
  title: null,
  summary: 'Mobility flow\nmore',
};

describe('schedule pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(() => {
    // 00:30 on Friday 13 Nov in Sofia (still the 12th in UTC). Only Date is faked.
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-12T22:30:00Z'),
    });
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'workouts/schedule', component: SchedulesComponent },
          { path: 'gyms/:id/schedule', component: ScheduleTemplateComponent },
          { path: 'gyms/:id', component: GymDetailsComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  }

  const day = (key: string) =>
    page.query(`[data-testid="schedule-day-${key}"]`)!;
  const dayText = (key: string) =>
    (day(key).textContent ?? '').replace(/\s+/g, ' ').trim();
  /** Each training of a day as "time trainer [chips]", its parts joined by spaces. */
  const slotLines = (key: string) =>
    Array.from(
      day(key).querySelectorAll('[data-testid^="schedule-slot-"]'),
    ).map((row) =>
      Array.from(row.children)
        .map((part) => (part.textContent ?? '').trim())
        .filter(Boolean)
        .join(' '),
    );
  const button = (root: Element, name: string) =>
    Array.from(root.querySelectorAll('button')).find(
      (b) =>
        b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    );

  describe('Schedule tab', () => {
    /** Opens the page and answers the catalogues it loads first. */
    async function openSchedule(url: string): Promise<void> {
      await open(url);
      http.expectOne('/api/gym-locations').flush(GYMS);
      http.expectOne('/api/training-times').flush(TIMES);
      http.expectOne('/api/trainers?active=true').flush(TRAINERS);
      await page.settle();
    }

    async function showWeek(answer: object = WEEK): Promise<void> {
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(answer);
      await page.settle();
      http
        .expectOne('/api/workouts?from=2026-11-09&to=2026-11-15')
        .flush([WORKOUT_SAT, WORKOUT_SAT_2]);
      await page.settle();
    }

    it('opens the gym and week in the address, and offers the active gyms', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule?gym=gym-n&week=2026-11-18');

      http
        .expectOne('/api/schedules?gymId=gym-n&week=2026-11-16')
        .flush({ ...NOT_CREATED, gym: { id: 'gym-n', name: 'North' } });
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-n').flush({
        ...TEMPLATE,
        gym: { id: 'gym-n', name: 'North' },
      });
      await page.settle();

      const gyms = page.queryAll<HTMLInputElement>(
        'fieldset input[type="radio"]',
      );
      expect(gyms.map((g) => g.parentElement!.textContent.trim())).toEqual([
        'Center',
        'North',
      ]);
      expect(gyms[1].checked).toBe(true);
      expect(
        page.query('[data-testid="schedule-week"]')!.textContent,
      ).toContain('16 Nov – 22 Nov 2026');
      expect(page.text()).toContain(
        "Create a draft from the North weekly template (3 trainings). Trainees won't see it until you review it and publish it",
      );
    });

    it('without a gym in the address, a trainer gets their primary gym, even over the one picked last', async () => {
      signInAs('TRAINER', { trainerProfileId: VASKO.id });
      localStorage.setItem(SCHEDULE_GYM_KEY, 'gym-c');
      await open('/workouts/schedule');
      http.expectOne('/api/gym-locations').flush(GYMS);
      http.expectOne('/api/training-times').flush(TIMES);
      http.expectOne('/api/trainers?active=true').flush([
        { ...VELCHO, accountId: null, primaryGymId: 'gym-c' },
        { ...VASKO, accountId: null, primaryGymId: 'gym-n' },
      ]);
      await page.settle();

      http
        .expectOne('/api/schedules?gymId=gym-n&week=2026-11-09')
        .flush({ ...NOT_CREATED, gym: { id: 'gym-n', name: 'North' } });
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-n').flush(TEMPLATE);
      await page.settle();
    });

    it('without a gym in the address, opens the one picked last on this device, and remembers a new pick', async () => {
      signInAs('TRAINER');
      localStorage.setItem(SCHEDULE_GYM_KEY, 'gym-n');
      await openSchedule('/workouts/schedule');
      http
        .expectOne('/api/schedules?gymId=gym-n&week=2026-11-09')
        .flush({ ...NOT_CREATED, gym: { id: 'gym-n', name: 'North' } });
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-n').flush(TEMPLATE);
      await page.settle();

      const center = page.queryAll<HTMLInputElement>(
        'fieldset input[type="radio"]',
      )[0];
      center.click();
      center.dispatchEvent(new Event('change'));
      await page.settle();

      expect(localStorage.getItem(SCHEDULE_GYM_KEY)).toBe('gym-c');
      expect(router.url).toBe('/workouts/schedule?gym=gym-c');
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();
    });

    it('creates a draft week from the template, then shows it as a draft to review', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();
      expect(page.text()).toContain(texts.week.notCreatedTitle);

      await page.click('[data-testid="schedule-create-week"]');
      const create = http.expectOne('/api/schedules');
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual({
        gymId: 'gym-c',
        week: '2026-11-09',
      });
      create.flush(DRAFT);
      await page.settle();
      await showWeek(DRAFT);

      expect(page.queryAll('[data-testid^="schedule-day-"]')).toHaveLength(7);
      expect(slotLines('2026-11-14')).toEqual([
        '07:10 – 08:10 Velcho Sokolov Helen',
      ]);
      expect(
        page.query('[data-testid="schedule-draft"]')?.textContent,
      ).toContain(texts.week.draftTitle);
      expect(page.query('[data-testid="schedule-published"]')).toBeNull();
      expect(page.text()).toContain('Draft with 3 trainings');
      expect(
        page.query<HTMLButtonElement>('[data-testid="schedule-publish"]')
          ?.disabled,
      ).toBe(false);
    });

    it('a published week says so and offers no publish or discard', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      expect(page.text()).toContain(texts.week.publishedHint);
      expect(page.query('[data-testid="schedule-draft"]')).toBeNull();
      expect(page.query('[data-testid="schedule-publish"]')).toBeNull();
      expect(page.query('[data-testid="schedule-discard-draft"]')).toBeNull();
    });

    it('publishes the draft once confirmed, and then shows it as published', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek(DRAFT);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

      await page.click('[data-testid="schedule-publish"]');
      expect(confirm).toHaveBeenCalledWith(
        "Publish the Center schedule for 9 Nov – 15 Nov 2026 (3 trainings)? Trainees will see it and can book its trainings. It can't go back to a draft.",
      );
      http.expectNone('/api/schedules/week-1/publish');

      confirm.mockReturnValueOnce(true);
      await page.click('[data-testid="schedule-publish"]');
      const publish = http.expectOne('/api/schedules/week-1/publish');
      expect(publish.request.method).toBe('POST');
      expect(publish.request.body).toEqual({});
      expect(
        page.query<HTMLButtonElement>('[data-testid="schedule-publish"]')
          ?.textContent,
      ).toContain(texts.week.publishing);
      publish.flush(WEEK);
      await page.settle();

      expect(page.query('[data-testid="schedule-draft"]')).toBeNull();
      expect(page.query('[data-testid="schedule-publish"]')).toBeNull();
      expect(page.text()).toContain(texts.week.publishedHint);
      expect(slotLines('2026-11-14')).toEqual([
        '07:10 – 08:10 Velcho Sokolov Helen',
      ]);
    });

    it("keeps the draft and shows the API's message when publishing fails", async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek(DRAFT);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await page.click('[data-testid="schedule-publish"]');
      flushError(
        http.expectOne('/api/schedules/week-1/publish'),
        'This week is already published',
        409,
      );
      await page.settle();

      expect(page.alert()).toBe('This week is already published');
      expect(page.query('[data-testid="schedule-draft"]')).not.toBeNull();
    });

    it('waits for an open training form before publishing', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek(DRAFT);

      button(
        day('2026-11-14'),
        'Add a training on Saturday, 14 November',
      )!.click();
      await page.settle();

      const publish = page.query<HTMLButtonElement>(
        '[data-testid="schedule-publish"]',
      )!;
      expect(publish.disabled).toBe(true);
      expect(page.text()).toContain(texts.week.finishEditing);
    });

    it('discards the draft once confirmed, and offers the template again', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek(DRAFT);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);

      await page.click('[data-testid="schedule-discard-draft"]');
      expect(confirm).toHaveBeenCalledWith(
        'Discard the Center draft for 9 Nov – 15 Nov 2026? Its trainings and the changes made to them are deleted; you can create the week from the template again.',
      );
      http.expectNone('/api/schedules/week-1');

      confirm.mockReturnValueOnce(true);
      await page.click('[data-testid="schedule-discard-draft"]');
      const discard = http.expectOne('/api/schedules/week-1');
      expect(discard.request.method).toBe('DELETE');
      discard.flush({ deleted: true });
      await page.settle();
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();

      expect(page.text()).toContain(texts.week.notCreatedTitle);
      expect(
        page.query('[data-testid="schedule-create-week"]')?.textContent,
      ).toContain(texts.week.create);
    });

    it("shows the API's reason when the week can't be created", async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();

      await page.click('[data-testid="schedule-create-week"]');
      flushError(
        http.expectOne('/api/schedules'),
        'This week has already been created',
        409,
      );
      await page.settle();

      expect(page.alert()).toBe('This week has already been created');
    });

    it('says when a gym has no template; only an admin gets the link to set it up', async () => {
      signInAs('ADMIN');
      await openSchedule('/workouts/schedule');
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http
        .expectOne('/api/schedule-templates/gym-c')
        .flush({ ...TEMPLATE, slots: [] });
      await page.settle();

      expect(page.text()).toContain(texts.week.noTemplateMessage);
      expect(page.query('[data-testid="schedule-create-week"]')).toBeNull();
      const link = page
        .queryAll<HTMLAnchorElement>('a')
        .find((a) => a.textContent?.trim() === texts.week.setUpTemplate);
      expect(link?.getAttribute('href')).toBe('/gyms/gym-c/schedule');
    });

    it('a trainer sees no template link', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      http
        .expectOne('/api/schedules?gymId=gym-c&week=2026-11-09')
        .flush(NOT_CREATED);
      await page.settle();
      http
        .expectOne('/api/schedule-templates/gym-c')
        .flush({ ...TEMPLATE, slots: [] });
      await page.settle();

      expect(page.text()).toContain(texts.week.noTemplateMessage);
      expect(page.text()).not.toContain(texts.week.setUpTemplate);
    });

    it('a week that is over says so and offers nothing', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule?gym=gym-c&week=2026-11-02');
      http.expectOne('/api/schedules?gymId=gym-c&week=2026-11-02').flush({
        ...NOT_CREATED,
        weekStart: '2026-11-02',
        weekEnd: '2026-11-08',
      });
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();

      expect(page.text()).toContain(texts.week.overMessage);
      expect(page.query('[data-testid="schedule-create-week"]')).toBeNull();
    });

    it('keeps today and earlier days read-only and lists each day in order', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      expect(page.text()).toContain(texts.week.lockedHint);
      // Thursday (past) and Friday (today, gym-local) show their trainings without actions.
      expect(slotLines('2026-11-12')).toEqual(['07:10 – 08:10 Velcho Sokolov']);
      expect(day('2026-11-12').querySelectorAll('button')).toHaveLength(0);
      expect(dayText('2026-11-13')).toContain('Today');
      expect(day('2026-11-13').querySelectorAll('button')).toHaveLength(0);
      // Saturday can change: edit, remove and add.
      const saturday = day('2026-11-14');
      expect(
        button(
          saturday,
          'Edit Saturday, 14 November 07:10 – 08:10 Velcho Sokolov',
        ),
      ).toBeDefined();
      expect(
        button(
          saturday,
          'Remove Saturday, 14 November 07:10 – 08:10 Velcho Sokolov',
        ),
      ).toBeDefined();
      expect(
        button(saturday, 'Add a training on Saturday, 14 November'),
      ).toBeDefined();
      expect(dayText('2026-11-15')).toContain(texts.days.noTrainings);
    });

    it('links every training, today and earlier days too, to its page with who booked it', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      const details = page
        .queryAll<HTMLAnchorElement>('a[aria-label^="Details of"]')
        .map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')]);
      expect(details).toEqual([
        [
          'Details of Thursday, 12 November 07:10 – 08:10 Velcho Sokolov',
          '/workouts/schedule/s-thu',
        ],
        [
          'Details of Friday, 13 November 17:00 – 18:00 Vasko',
          '/workouts/schedule/s-fri',
        ],
        [
          'Details of Saturday, 14 November 07:10 – 08:10 Velcho Sokolov',
          '/workouts/schedule/s-sat',
        ],
      ]);

      page
        .query<HTMLAnchorElement>('a[href="/workouts/schedule/s-fri"]')!
        .click();
      await page.settle();
      expect(router.url).toBe('/workouts/schedule/s-fri');
    });

    it("adds a training with a new training time and the day's workout", async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      button(
        day('2026-11-14'),
        'Add a training on Saturday, 14 November',
      )!.click();
      await page.settle();
      const form = '[data-testid="schedule-slot-form"]';
      const workoutOptions = page
        .queryAll<HTMLOptionElement>(`${form} select[id$="-workout"] option`)
        .map((o) => o.textContent.trim());
      expect(workoutOptions).toEqual(['No workout', 'Helen', 'Mobility flow']);

      await page.select(`${form} select[id$="-time"]`, 'new');
      await page.type(`${form} input[id$="-start"]`, '12:30');
      await page.type(`${form} input[id$="-end"]`, '13:30');
      await page.select(`${form} select[id$="-trainer"]`, VASKO.id);
      await page.select(`${form} select[id$="-workout"]`, 'w-sat');
      expect(
        page.query('[data-testid="schedule-new-time"]')!.textContent.trim(),
      ).toBe(
        '12:30 – 13:30 is a new training time: it is added to the training times when you save.',
      );
      await page.submit(form);

      const add = http.expectOne('/api/schedules/week-1/slots');
      expect(add.request.method).toBe('POST');
      expect(add.request.body).toEqual({
        trainingTime: { startTime: '12:30', endTime: '13:30' },
        date: '2026-11-14',
        trainerId: VASKO.id,
        workoutId: 'w-sat',
      });
      add.flush(weekSlot('s-new', '2026-11-14', MORNING, VASKO));
      await page.settle();
      const lunch = {
        id: 'tt-lunch',
        startTime: '12:30:00',
        endTime: '13:30:00',
      };
      http.expectOne('/api/schedules?gymId=gym-c&week=2026-11-09').flush({
        ...WEEK,
        slots: [
          ...WEEK.slots,
          weekSlot('s-new', '2026-11-14', lunch, VASKO, {
            id: 'w-sat',
            title: 'Helen',
          }),
        ],
      });
      http.expectOne('/api/training-times').flush([...TIMES, lunch]);
      await page.settle();

      expect(page.query(form)).toBeNull();
      expect(slotLines('2026-11-14')).toEqual([
        '07:10 – 08:10 Velcho Sokolov Helen',
        '12:30 – 13:30 Vasko Helen',
      ]);
    });

    it('typed hours that a training time has already use it', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      button(
        day('2026-11-15'),
        'Add a training on Sunday, 15 November',
      )!.click();
      await page.settle();
      const form = '[data-testid="schedule-slot-form"]';
      await page.select(`${form} select[id$="-time"]`, 'new');
      await page.type(`${form} input[id$="-start"]`, '17:00');
      await page.type(`${form} input[id$="-end"]`, '18:00');
      await page.select(`${form} select[id$="-trainer"]`, VELCHO.id);
      expect(
        page.query('[data-testid="schedule-new-time"]')!.textContent,
      ).toContain('is already a training time');
      await page.submit(form);

      const add = http.expectOne('/api/schedules/week-1/slots');
      expect(add.request.body).toEqual({
        trainingTimeId: EVENING.id,
        date: '2026-11-15',
        trainerId: VELCHO.id,
        workoutId: null,
      });
      add.flush(weekSlot('s-new', '2026-11-15', EVENING, VELCHO));
      await page.settle();
      // No new training time, so only the week is asked for again.
      http.expectOne('/api/schedules?gymId=gym-c&week=2026-11-09').flush(WEEK);
      await page.settle();
    });

    it('asks for the missing fields and sends nothing', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      button(
        day('2026-11-15'),
        'Add a training on Sunday, 15 November',
      )!.click();
      await page.settle();
      await page.submit('[data-testid="schedule-slot-form"]');

      expect(page.text()).toContain(texts.slot.trainingTimeError);
      expect(page.text()).toContain(texts.slot.trainerError);
    });

    it('changing a training sends only what changed, and shows an API error in the form', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();

      button(
        day('2026-11-14'),
        'Edit Saturday, 14 November 07:10 – 08:10 Velcho Sokolov',
      )!.click();
      await page.settle();
      const form = '[data-testid="schedule-slot-form"]';
      await page.select(`${form} select[id$="-time"]`, EVENING.id);
      await page.submit(form);

      const first = http.expectOne('/api/schedules/slots/s-sat');
      expect(first.request.method).toBe('PATCH');
      expect(first.request.body).toEqual({ trainingTimeId: EVENING.id });
      flushError(
        first,
        'Trainings of today and earlier days can no longer be changed',
      );
      await page.settle();
      expect(page.alert()).toBe(
        'Trainings of today and earlier days can no longer be changed',
      );

      await page.select(`${form} select[id$="-workout"]`, '');
      await page.submit(form);
      const second = http.expectOne('/api/schedules/slots/s-sat');
      expect(second.request.body).toEqual({
        trainingTimeId: EVENING.id,
        workoutId: null,
      });
      second.flush(weekSlot('s-sat', '2026-11-14', EVENING, VELCHO));
      await page.settle();
      http.expectOne('/api/schedules?gymId=gym-c&week=2026-11-09').flush(WEEK);
      await page.settle();
      expect(page.query(form)).toBeNull();
    });

    it("shows each training's bookings, and refuses to remove a booked one without asking the API", async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek({
        ...WEEK,
        slots: WEEK.slots.map((s) =>
          s.id === 's-sat' ? { ...s, bookedCount: 2 } : s,
        ),
      });
      const confirm = vi.spyOn(window, 'confirm');

      expect(slotLines('2026-11-14')).toEqual([
        '07:10 – 08:10 Velcho Sokolov Helen 2 booked',
      ]);
      expect(slotLines('2026-11-12')).toEqual(['07:10 – 08:10 Velcho Sokolov']);
      button(
        day('2026-11-14'),
        'Remove Saturday, 14 November 07:10 – 08:10 Velcho Sokolov',
      )!.click();
      await page.settle();

      expect(confirm).not.toHaveBeenCalled();
      expect(page.alert()).toBe(
        "This training has 2 bookings, so it can't be removed.",
      );
      http.expectNone('/api/schedules/slots/s-sat');
    });

    it('removes a training once confirmed', async () => {
      signInAs('TRAINER');
      await openSchedule('/workouts/schedule');
      await showWeek();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      const remove =
        'Remove Saturday, 14 November 07:10 – 08:10 Velcho Sokolov';

      button(day('2026-11-14'), remove)!.click();
      await page.settle();
      expect(confirm).toHaveBeenCalledWith(
        'Remove the 07:10 – 08:10 training with Velcho Sokolov on Saturday, 14 November?',
      );
      http.expectNone('/api/schedules/slots/s-sat');

      confirm.mockReturnValueOnce(true);
      button(day('2026-11-14'), remove)!.click();
      await page.settle();
      const del = http.expectOne('/api/schedules/slots/s-sat');
      expect(del.request.method).toBe('DELETE');
      del.flush({ deleted: true });
      await page.settle();
      http.expectOne('/api/schedules?gymId=gym-c&week=2026-11-09').flush({
        ...WEEK,
        slots: WEEK.slots.slice(0, 2),
      });
      await page.settle();

      expect(dayText('2026-11-14')).toContain(texts.days.noTrainings);
    });
  });

  describe('weekly template', () => {
    async function openTemplate(): Promise<void> {
      await open('/gyms/gym-c/schedule');
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      http.expectOne('/api/training-times').flush(TIMES);
      http.expectOne('/api/trainers?active=true').flush(TRAINERS);
      await page.settle();
    }

    it("shows the gym's usual week, Monday to Sunday", async () => {
      signInAs('ADMIN');
      await openTemplate();

      expect(page.query('h1')!.textContent).toContain(
        'Weekly template: Center',
      );
      expect(
        page
          .query('[data-testid="schedule-template-count"]')!
          .textContent.trim(),
      ).toBe('3 trainings a week');
      expect(slotLines('1')).toEqual([
        '07:10 – 08:10 Velcho Sokolov',
        '17:00 – 18:00 Vasko',
      ]);
      expect(dayText('2')).toContain(texts.days.noTrainings);
      expect(slotLines('3')).toEqual(['07:10 – 08:10 Velcho Sokolov']);
      // A template's trainings have no page of their own.
      expect(page.queryAll('a[aria-label^="Details of"]')).toEqual([]);
      // No workout field in a template.
      button(day('2'), 'Add a training on Tuesday')!.click();
      await page.settle();
      expect(page.query('select[id$="-workout"]')).toBeNull();
    });

    it('adds a training on a weekday and shows the template again', async () => {
      signInAs('ADMIN');
      await openTemplate();

      button(day('5'), 'Add a training on Friday')!.click();
      await page.settle();
      const form = '[data-testid="schedule-slot-form"]';
      await page.select(`${form} select[id$="-time"]`, EVENING.id);
      await page.select(`${form} select[id$="-trainer"]`, VASKO.id);
      await page.submit(form);

      const add = http.expectOne('/api/schedule-templates/gym-c/slots');
      expect(add.request.method).toBe('POST');
      expect(add.request.body).toEqual({
        trainingTimeId: EVENING.id,
        weekday: 5,
        trainerId: VASKO.id,
      });
      add.flush(templateSlot('ts-4', 5, EVENING, VASKO));
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush({
        ...TEMPLATE,
        slots: [...TEMPLATE.slots, templateSlot('ts-4', 5, EVENING, VASKO)],
      });
      await page.settle();

      expect(slotLines('5')).toEqual(['17:00 – 18:00 Vasko']);
      expect(page.text()).toContain('4 trainings a week');
    });

    it('keeps an inactive trainer on a training unless another one is chosen', async () => {
      signInAs('ADMIN');
      await open('/gyms/gym-c/schedule');
      const retired = trainer('tr-retired', 'Retired', false);
      http.expectOne('/api/schedule-templates/gym-c').flush({
        ...TEMPLATE,
        slots: [templateSlot('ts-r', 2, MORNING, retired)],
      });
      http.expectOne('/api/training-times').flush(TIMES);
      http.expectOne('/api/trainers?active=true').flush(TRAINERS);
      await page.settle();
      expect(slotLines('2')).toEqual(['07:10 – 08:10 Retired Inactive']);

      button(day('2'), 'Edit Tuesday 07:10 – 08:10 Retired')!.click();
      await page.settle();
      const form = '[data-testid="schedule-slot-form"]';
      expect(
        page
          .query<HTMLSelectElement>(`${form} select[id$="-trainer"]`)!
          .selectedOptions[0].textContent.trim(),
      ).toBe('Retired (inactive)');
      await page.select(`${form} select[id$="-time"]`, EVENING.id);
      await page.submit(form);

      const patch = http.expectOne('/api/schedule-templates/slots/ts-r');
      expect(patch.request.body).toEqual({ trainingTimeId: EVENING.id });
      patch.flush(templateSlot('ts-r', 2, EVENING, retired));
      await page.settle();
      http.expectOne('/api/schedule-templates/gym-c').flush(TEMPLATE);
      await page.settle();
    });

    it('removes a training once confirmed, and shows a failure above the days', async () => {
      signInAs('ADMIN');
      await openTemplate();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      button(
        day('3'),
        'Remove Wednesday 07:10 – 08:10 Velcho Sokolov',
      )!.click();
      await page.settle();

      expect(window.confirm).toHaveBeenCalledWith(
        'Remove the 07:10 – 08:10 training with Velcho Sokolov on Wednesday from the template?',
      );
      const del = http.expectOne('/api/schedule-templates/slots/ts-3');
      expect(del.request.method).toBe('DELETE');
      flushError(del, undefined, 500);
      await page.settle();
      expect(page.alert()).toBe(texts.slot.removeError);
    });
  });

  describe('gym details', () => {
    async function openGym(): Promise<void> {
      await open('/gyms/gym-c');
      http.expectOne('/api/gym-locations/gym-c').flush(GYMS[0]);
      await page.settle();
    }

    it('links an admin to the weekly template', async () => {
      signInAs('ADMIN');
      await openGym();

      expect(
        page
          .query('[data-testid="gym-schedule-template"]')!
          .getAttribute('href'),
      ).toBe('/gyms/gym-c/schedule');
    });

    it('shows a trainer no template link', async () => {
      signInAs('TRAINER');
      await openGym();

      expect(page.query('[data-testid="gym-schedule-template"]')).toBeNull();
    });
  });
});

function flushError(
  request: TestRequest,
  message?: string,
  status = 400,
): void {
  const error = apiError(message, status);
  request.flush(error.body, error.options);
}
