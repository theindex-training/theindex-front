import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../testing/dom';
import { signInAs } from '../../testing/jwt';
import { GymSubscriptionCreateComponent } from './gym-subscriptions/gym-subscription-create.component';
import { GymSubscriptionDeleteComponent } from './gym-subscriptions/gym-subscription-delete.component';
import { GymSubscriptionDetailsComponent } from './gym-subscriptions/gym-subscription-details.component';
import { GymSubscriptionEditComponent } from './gym-subscriptions/gym-subscription-edit.component';
import { GymCreateComponent } from './gyms/gym-create.component';
import { GymDeleteComponent } from './gyms/gym-delete.component';
import { GymDetailsComponent } from './gyms/gym-details.component';
import { GymEditComponent } from './gyms/gym-edit.component';
import { PlanDeleteComponent } from './plans/plan-delete.component';
import { PlanDetailsComponent } from './plans/plan-details.component';
import { TraineeCreateComponent } from './trainees/trainee-create.component';
import { TraineeDeleteComponent } from './trainees/trainee-delete.component';
import { TraineeEditComponent } from './trainees/trainee-edit.component';
import { TrainerCreateComponent } from './trainers/trainer-create.component';
import { TrainerDeleteComponent } from './trainers/trainer-delete.component';
import { TrainerDetailsComponent } from './trainers/trainer-details.component';
import { TrainerEditComponent } from './trainers/trainer-edit.component';
import { TrainingTimeCreateComponent } from './training-times/training-time-create.component';
import { TrainingTimeDeleteComponent } from './training-times/training-time-delete.component';
import { TrainingTimeDetailsComponent } from './training-times/training-time-details.component';
import { TrainingTimeEditComponent } from './training-times/training-time-edit.component';

/**
 * The catalog CRUD pages (TEST_PLAN.md §7), table-driven. Plan create/edit have their own specs;
 * failed saves are covered by save-errors.spec.ts.
 */

const PLAN = {
  id: 'p1',
  type: 'PUNCH',
  title: '10 visits',
  priceCents: 4550,
  credits: 10,
  durationDays: null,
  isActive: true,
};
const GYM = {
  id: 'g1',
  name: 'Center',
  address: 'Main St 1',
  notes: null,
  isActive: true,
};
const GYM_SUBSCRIPTION = { id: 'gs1', name: 'Sports card', isActive: true };
const TRAINING_TIME = { id: 'tt1', startTime: '18:00:00', endTime: '19:00:00' };
const TRAINER = {
  id: 'tr1',
  name: 'Petar Petrov',
  nickname: 'Pepi',
  accountId: null,
  isActive: true,
};
const TRAINEE = {
  id: 't1',
  name: 'Ivan Petrov',
  nickname: 'Vanko',
  phone: '+359888123456',
  accountId: null,
  gymSubscriptionId: 'gs1',
  isActive: true,
};
const GYM_CARDS = [
  GYM_SUBSCRIPTION,
  { id: 'gs2', name: 'Other card', isActive: true },
];

/** Every page under test, by URL pattern. "missing-id/<n>" opens the same page without an :id. */
const PAGES: Record<string, Type<unknown>> = {
  'plans/:id': PlanDetailsComponent,
  'plans/:id/delete': PlanDeleteComponent,
  'gyms/new': GymCreateComponent,
  'gyms/:id': GymDetailsComponent,
  'gyms/:id/edit': GymEditComponent,
  'gyms/:id/delete': GymDeleteComponent,
  'gym-subscriptions/new': GymSubscriptionCreateComponent,
  'gym-subscriptions/:id': GymSubscriptionDetailsComponent,
  'gym-subscriptions/:id/edit': GymSubscriptionEditComponent,
  'gym-subscriptions/:id/delete': GymSubscriptionDeleteComponent,
  'training-times/new': TrainingTimeCreateComponent,
  'training-times/:id': TrainingTimeDetailsComponent,
  'training-times/:id/edit': TrainingTimeEditComponent,
  'training-times/:id/delete': TrainingTimeDeleteComponent,
  'trainers/new': TrainerCreateComponent,
  'trainers/:id': TrainerDetailsComponent,
  'trainers/:id/edit': TrainerEditComponent,
  'trainers/:id/delete': TrainerDeleteComponent,
  'trainees/new': TraineeCreateComponent,
  'trainees/:id/edit': TraineeEditComponent,
  'trainees/:id/delete': TraineeDeleteComponent,
};

describe('catalog pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          ...Object.entries(PAGES).map(([path, component]) => ({
            path,
            component,
          })),
          ...Object.values(PAGES).map((component, index) => ({
            path: `missing-id/${index}`,
            component,
          })),
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(url: string, loads: Record<string, object> = {}) {
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    for (const [loadUrl, body] of Object.entries(loads)) {
      http.expectOne(loadUrl).flush(body);
    }
    await page.settle();
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement>(selector)!.value;
  const button = (label: string) =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((candidate) => candidate.textContent?.trim() === label);

  describe('pages for one record', () => {
    interface RecordCase {
      url: string;
      /** The GET that loads the record, and any other load the page makes first. */
      recordUrl: string;
      otherLoads?: Record<string, object>;
      record: object;
      missingIdMessage: string;
      /** What proves the record is on the page. */
      shows: () => void;
    }

    const recordCases: [string, RecordCase][] = [
      [
        'plan details',
        {
          url: '/plans/p1',
          recordUrl: '/api/plans/p1',
          record: PLAN,
          missingIdMessage: en.plans.errors.missingId,
          shows: () => expect(page.text()).toContain('10 visits'),
        },
      ],
      [
        'plan deactivate',
        {
          url: '/plans/p1/delete',
          recordUrl: '/api/plans/p1',
          record: PLAN,
          missingIdMessage: en.plans.errors.missingId,
          shows: () => expect(page.text()).toContain('10 visits'),
        },
      ],
      [
        'gym details',
        {
          url: '/gyms/g1',
          recordUrl: '/api/gym-locations/g1',
          record: GYM,
          missingIdMessage: en.gyms.errors.missingId,
          shows: () => expect(page.text()).toContain('Main St 1'),
        },
      ],
      [
        'gym edit',
        {
          url: '/gyms/g1/edit',
          recordUrl: '/api/gym-locations/g1',
          record: GYM,
          missingIdMessage: en.gyms.errors.missingId,
          shows: () => expect(value('#gym-address')).toBe('Main St 1'),
        },
      ],
      [
        'gym deactivate',
        {
          url: '/gyms/g1/delete',
          recordUrl: '/api/gym-locations/g1',
          record: GYM,
          missingIdMessage: en.gyms.errors.missingId,
          shows: () => expect(page.text()).toContain('Center'),
        },
      ],
      [
        'gym subscription details',
        {
          url: '/gym-subscriptions/gs1',
          recordUrl: '/api/gym-subscriptions/gs1',
          record: GYM_SUBSCRIPTION,
          missingIdMessage: en.gymSubscriptions.errors.missingId,
          shows: () => expect(page.text()).toContain('Sports card'),
        },
      ],
      [
        'gym subscription edit',
        {
          url: '/gym-subscriptions/gs1/edit',
          recordUrl: '/api/gym-subscriptions/gs1',
          record: GYM_SUBSCRIPTION,
          missingIdMessage: en.gymSubscriptions.errors.missingId,
          shows: () =>
            expect(value('#gym-subscription-name')).toBe('Sports card'),
        },
      ],
      [
        'gym subscription deactivate',
        {
          url: '/gym-subscriptions/gs1/delete',
          recordUrl: '/api/gym-subscriptions/gs1',
          record: GYM_SUBSCRIPTION,
          missingIdMessage: en.gymSubscriptions.errors.missingId,
          shows: () => expect(page.text()).toContain('Sports card'),
        },
      ],
      [
        'training time details',
        {
          url: '/training-times/tt1',
          recordUrl: '/api/training-times/tt1',
          record: TRAINING_TIME,
          missingIdMessage: en.trainingTimes.errors.missingId,
          shows: () => {
            expect(page.text()).toContain('18:00');
            expect(page.text()).not.toContain('18:00:00');
          },
        },
      ],
      [
        'training time edit',
        {
          url: '/training-times/tt1/edit',
          recordUrl: '/api/training-times/tt1',
          record: TRAINING_TIME,
          missingIdMessage: en.trainingTimes.errors.missingId,
          shows: () =>
            expect(value('#training-time-start-time')).toBe('18:00:00'),
        },
      ],
      [
        'training time delete',
        {
          url: '/training-times/tt1/delete',
          recordUrl: '/api/training-times/tt1',
          record: TRAINING_TIME,
          missingIdMessage: en.trainingTimes.errors.missingId,
          shows: () => expect(page.text()).toContain('19:00'),
        },
      ],
      [
        'trainer details',
        {
          url: '/trainers/tr1',
          recordUrl: '/api/trainers/tr1',
          record: TRAINER,
          missingIdMessage: en.trainers.errors.missingId,
          shows: () => expect(page.text()).toContain('Pepi'),
        },
      ],
      [
        'trainer edit',
        {
          url: '/trainers/tr1/edit',
          recordUrl: '/api/trainers/tr1',
          record: TRAINER,
          missingIdMessage: en.trainers.errors.missingId,
          shows: () => expect(value('#trainer-nickname')).toBe('Pepi'),
        },
      ],
      [
        'trainer deactivate',
        {
          url: '/trainers/tr1/delete',
          recordUrl: '/api/trainers/tr1',
          record: TRAINER,
          missingIdMessage: en.trainers.errors.missingId,
          shows: () => expect(page.text()).toContain('Petar Petrov'),
        },
      ],
      [
        'trainee edit',
        {
          url: '/trainees/t1/edit',
          recordUrl: '/api/trainees/t1',
          otherLoads: {
            '/api/gym-subscriptions?includeInactive=true': GYM_CARDS,
          },
          record: TRAINEE,
          missingIdMessage: en.trainees.errors.missingId,
          shows: () => {
            expect(value('#trainee-phone')).toBe('+359888123456');
            expect(
              page.query<HTMLSelectElement>('#trainee-gym-subscription')!.value,
            ).toBe('gs1');
          },
        },
      ],
      [
        'trainee deactivate',
        {
          url: '/trainees/t1/delete',
          recordUrl: '/api/trainees/t1',
          record: TRAINEE,
          missingIdMessage: en.trainees.errors.missingId,
          shows: () => {
            expect(page.text()).toContain('Vanko');
            expect(page.text()).toContain(en.common.notLinked);
          },
        },
      ],
    ];

    it.each(recordCases)(
      '%s: loads and shows the record',
      async (_, testCase) => {
        await open(testCase.url, {
          ...testCase.otherLoads,
          [testCase.recordUrl]: testCase.record,
        });

        testCase.shows();
      },
    );

    it.each(recordCases)(
      '%s: shows the API error when the record cannot be loaded',
      async (_, testCase) => {
        await harness.navigateByUrl(testCase.url);
        page = driver(
          () => harness.routeNativeElement!,
          () => harness.fixture.whenStable(),
        );
        for (const [loadUrl, body] of Object.entries(
          testCase.otherLoads ?? {},
        )) {
          http.expectOne(loadUrl).flush(body);
        }
        const error = apiError('Not found', 404);
        http.expectOne(testCase.recordUrl).flush(error.body, error.options);
        await page.settle();

        expect(page.alert()).toBe('Not found');
      },
    );

    it.each(recordCases)(
      '%s: reports a missing id without calling the API',
      async (_, testCase) => {
        const pattern = Object.keys(PAGES).find((key) =>
          new RegExp(`^${key.replace(':id', '[^/]+')}$`).test(
            testCase.url.slice(1),
          ),
        )!;
        await harness.navigateByUrl(
          `/missing-id/${Object.keys(PAGES).indexOf(pattern)}`,
        );
        page = driver(
          () => harness.routeNativeElement!,
          () => harness.fixture.whenStable(),
        );
        await page.settle();

        http.expectNone(() => true);
        expect(page.alert()).toBe(testCase.missingIdMessage);
      },
    );

    it('trainer details also loads the linked account', async () => {
      await open('/trainers/tr1', {
        '/api/trainers/tr1': { ...TRAINER, accountId: 'acc1' },
        '/api/accounts/acc1': {
          id: 'acc1',
          email: 'petar@gym.test',
          role: 'TRAINER',
          status: 'ACTIVE',
        },
      });

      expect(page.text()).toContain('petar@gym.test');
    });

    it('gym details shows a dash for a gym without an address', async () => {
      await open('/gyms/g1', {
        '/api/gym-locations/g1': { ...GYM, address: null },
      });

      expect(page.text()).toContain('—');
    });
  });

  describe('create and edit forms', () => {
    interface FormCase {
      url: string;
      loads?: Record<string, object>;
      fill: Record<string, string>;
      /** <select> values to pick, by selector. */
      pick?: Record<string, string>;
      request: { method: 'POST' | 'PATCH'; url: string; body: object };
      listUrl: string;
    }

    const formCases: [string, FormCase][] = [
      [
        'gym create',
        {
          url: '/gyms/new',
          fill: { '#gym-name': '  Center ', '#gym-address': ' Main St 1 ' },
          request: {
            method: 'POST',
            url: '/api/gym-locations',
            body: { name: 'Center', address: 'Main St 1' },
          },
          listUrl: '/gyms',
        },
      ],
      [
        'gym create, no address',
        {
          url: '/gyms/new',
          fill: { '#gym-name': 'Center' },
          request: {
            method: 'POST',
            url: '/api/gym-locations',
            body: { name: 'Center', address: null },
          },
          listUrl: '/gyms',
        },
      ],
      [
        'gym edit',
        {
          url: '/gyms/g1/edit',
          loads: { '/api/gym-locations/g1': GYM },
          fill: { '#gym-name': 'South', '#gym-address': '' },
          request: {
            method: 'PATCH',
            url: '/api/gym-locations/g1',
            body: { name: 'South', address: null },
          },
          listUrl: '/gyms',
        },
      ],
      [
        'gym subscription create',
        {
          url: '/gym-subscriptions/new',
          fill: { '#gym-subscription-name': ' Sports card ' },
          request: {
            method: 'POST',
            url: '/api/gym-subscriptions',
            body: { name: 'Sports card' },
          },
          listUrl: '/gym-subscriptions',
        },
      ],
      [
        'gym subscription edit',
        {
          url: '/gym-subscriptions/gs1/edit',
          loads: { '/api/gym-subscriptions/gs1': GYM_SUBSCRIPTION },
          fill: { '#gym-subscription-name': 'Multisport' },
          request: {
            method: 'PATCH',
            url: '/api/gym-subscriptions/gs1',
            body: { name: 'Multisport' },
          },
          listUrl: '/gym-subscriptions',
        },
      ],
      [
        'training time create',
        {
          url: '/training-times/new',
          fill: {
            '#training-time-start-time': '18:00',
            '#training-time-end-time': '19:30',
          },
          request: {
            method: 'POST',
            url: '/api/training-times',
            body: { startTime: '18:00', endTime: '19:30' },
          },
          listUrl: '/training-times',
        },
      ],
      // An untouched edit sends the times back as the API sent them, seconds included.
      [
        'training time edit',
        {
          url: '/training-times/tt1/edit',
          loads: { '/api/training-times/tt1': TRAINING_TIME },
          fill: { '#training-time-end-time': '20:00' },
          request: {
            method: 'PATCH',
            url: '/api/training-times/tt1',
            body: { startTime: '18:00:00', endTime: '20:00' },
          },
          listUrl: '/training-times',
        },
      ],
      [
        'trainer create',
        {
          url: '/trainers/new',
          fill: {
            '#trainer-name': ' Petar Petrov ',
            '#trainer-nickname': ' Pepi ',
          },
          request: {
            method: 'POST',
            url: '/api/trainers',
            body: { name: 'Petar Petrov', nickname: 'Pepi', isActive: true },
          },
          listUrl: '/trainers',
        },
      ],
      [
        'trainer create, no nickname',
        {
          url: '/trainers/new',
          fill: { '#trainer-name': 'Petar' },
          request: {
            method: 'POST',
            url: '/api/trainers',
            body: { name: 'Petar', nickname: null, isActive: true },
          },
          listUrl: '/trainers',
        },
      ],
      [
        'trainer edit (no isActive sent)',
        {
          url: '/trainers/tr1/edit',
          loads: { '/api/trainers/tr1': TRAINER },
          fill: { '#trainer-nickname': '' },
          request: {
            method: 'PATCH',
            url: '/api/trainers/tr1',
            body: { name: 'Petar Petrov', nickname: null },
          },
          listUrl: '/trainers',
        },
      ],
      [
        'trainee create',
        {
          url: '/trainees/new',
          loads: { '/api/gym-subscriptions': GYM_CARDS },
          fill: {
            '#trainee-name': ' Ivan Petrov ',
            '#trainee-nickname': 'Vanko',
            '#trainee-phone': ' +359 888 ',
          },
          pick: { '#trainee-gym-subscription': 'gs2' },
          request: {
            method: 'POST',
            url: '/api/trainees',
            body: {
              name: 'Ivan Petrov',
              nickname: 'Vanko',
              phone: '+359 888',
              gymSubscriptionId: 'gs2',
              isActive: true,
            },
          },
          listUrl: '/trainees',
        },
      ],
      [
        'trainee create, only a name',
        {
          url: '/trainees/new',
          loads: { '/api/gym-subscriptions': GYM_CARDS },
          fill: { '#trainee-name': 'Ivan' },
          request: {
            method: 'POST',
            url: '/api/trainees',
            body: {
              name: 'Ivan',
              nickname: null,
              phone: null,
              gymSubscriptionId: null,
              isActive: true,
            },
          },
          listUrl: '/trainees',
        },
      ],
      [
        'trainee edit (no isActive sent)',
        {
          url: '/trainees/t1/edit',
          loads: {
            '/api/gym-subscriptions?includeInactive=true': GYM_CARDS,
            '/api/trainees/t1': TRAINEE,
          },
          fill: { '#trainee-phone': '   ' },
          request: {
            method: 'PATCH',
            url: '/api/trainees/t1',
            body: {
              name: 'Ivan Petrov',
              nickname: 'Vanko',
              phone: null,
              gymSubscriptionId: 'gs1',
            },
          },
          listUrl: '/trainees',
        },
      ],
    ];

    it.each(formCases)(
      '%s: sends the payload and returns to the list',
      async (_, testCase) => {
        await open(testCase.url, testCase.loads);
        for (const [selector, text] of Object.entries(testCase.fill)) {
          await page.type(selector, text);
        }
        for (const [selector, option] of Object.entries(testCase.pick ?? {})) {
          await page.select(selector, option);
        }
        await page.submit();

        const req = http.expectOne(testCase.request.url);
        expect(req.request.method).toBe(testCase.request.method);
        expect(req.request.body).toEqual(testCase.request.body);
        req.flush({});
        await page.settle();

        expect(router.url).toBe(testCase.listUrl);
      },
    );

    const invalidCases: [
      string,
      string,
      Record<string, string>,
      string,
      Record<string, object>?,
    ][] = [
      ['gym name too short', '/gyms/new', { '#gym-name': ' A ' }, '#gym-name'],
      [
        'gym name too long',
        '/gyms/new',
        { '#gym-name': 'x'.repeat(121) },
        '#gym-name',
      ],
      [
        'gym address of only spaces',
        '/gyms/new',
        { '#gym-name': 'Center', '#gym-address': '   ' },
        '#gym-address',
      ],
      [
        'gym subscription name missing',
        '/gym-subscriptions/new',
        {},
        '#gym-subscription-name',
      ],
      [
        'training time end missing',
        '/training-times/new',
        { '#training-time-start-time': '18:00' },
        '#training-time-end-time',
      ],
      [
        'trainer name too short',
        '/trainers/new',
        { '#trainer-name': 'P' },
        '#trainer-name',
      ],
      [
        'trainer nickname too long',
        '/trainers/new',
        { '#trainer-name': 'Petar', '#trainer-nickname': 'x'.repeat(51) },
        '#trainer-nickname',
      ],
      [
        'trainee name too long',
        '/trainees/new',
        { '#trainee-name': 'x'.repeat(101) },
        '#trainee-name',
        { '/api/gym-subscriptions': [] },
      ],
    ];

    it.each(invalidCases)(
      '%s: sends nothing and flags the field',
      async (_, url, fill, invalidField, loads) => {
        await open(url, loads);
        for (const [selector, text] of Object.entries(fill)) {
          await page.type(selector, text);
        }
        await page.submit();

        http.expectNone(() => true);
        expect(page.query(invalidField)!.getAttribute('aria-invalid')).toBe(
          'true',
        );
      },
    );

    it('accepts a training time that ends before it starts', async () => {
      await open('/training-times/new');
      await page.type('#training-time-start-time', '19:00');
      await page.type('#training-time-end-time', '18:00');
      await page.submit();

      // CHARACTERIZATION: possibly unintended — no client-side check that the end is after the
      // start; only the API can reject it. TEST_NOTES.md S12.
      expect(http.expectOne('/api/training-times').request.body).toEqual({
        startTime: '19:00',
        endTime: '18:00',
      });
    });

    it('offers active gym cards when creating a trainee, and all of them when editing', async () => {
      await open('/trainees/new', { '/api/gym-subscriptions': GYM_CARDS });
      expect(page.queryAll('#trainee-gym-subscription option').length).toBe(3);

      await open('/trainees/t1/edit', {
        '/api/gym-subscriptions?includeInactive=true': [
          ...GYM_CARDS,
          { id: 'gs3', name: 'Old card', isActive: false },
        ],
        '/api/trainees/t1': TRAINEE,
      });
      expect(page.queryAll('#trainee-gym-subscription option').length).toBe(4);
    });

    it('still lets you create a trainee when the gym cards fail to load', async () => {
      await open('/trainees/new');
      const error = apiError(undefined, 500);
      http.expectOne('/api/gym-subscriptions').flush(error.body, error.options);
      await page.settle();
      await page.type('#trainee-name', 'Ivan');
      await page.submit();

      expect(
        http.expectOne('/api/trainees').request.body.gymSubscriptionId,
      ).toBeNull();
    });
  });

  describe('delete and deactivate', () => {
    const deleteCases: [
      string,
      string,
      Record<string, object>,
      string,
      string,
      string,
    ][] = [
      [
        'plan',
        '/plans/p1/delete',
        { '/api/plans/p1': PLAN },
        en.plans.delete.submit,
        '/api/plans/p1',
        '/plans',
      ],
      [
        'gym',
        '/gyms/g1/delete',
        { '/api/gym-locations/g1': GYM },
        en.gyms.delete.submit,
        '/api/gym-locations/g1',
        '/gyms',
      ],
      [
        'gym subscription',
        '/gym-subscriptions/gs1/delete',
        { '/api/gym-subscriptions/gs1': GYM_SUBSCRIPTION },
        en.gymSubscriptions.delete.submit,
        '/api/gym-subscriptions/gs1',
        '/gym-subscriptions',
      ],
      [
        'training time',
        '/training-times/tt1/delete',
        { '/api/training-times/tt1': TRAINING_TIME },
        en.trainingTimes.delete.submit,
        '/api/training-times/tt1',
        '/training-times',
      ],
      [
        'trainer',
        '/trainers/tr1/delete',
        { '/api/trainers/tr1': TRAINER },
        en.trainers.delete.submit,
        '/api/trainers/tr1',
        '/trainers',
      ],
      [
        'trainee',
        '/trainees/t1/delete',
        { '/api/trainees/t1': TRAINEE },
        en.trainees.delete.submit,
        '/api/trainees/t1',
        '/trainees',
      ],
    ];

    it.each(deleteCases)(
      '%s: confirming sends DELETE and returns to the list',
      async (_, url, loads, label, deleteUrl, listUrl) => {
        await open(url, loads);
        button(label)!.click();
        await page.settle();

        const req = http.expectOne(deleteUrl);
        expect(req.request.method).toBe('DELETE');
        req.flush({});
        await page.settle();

        expect(router.url).toBe(listUrl);
      },
    );

    it.each([
      [
        'plan',
        '/plans/p1/delete',
        { '/api/plans/p1': { ...PLAN, isActive: false } },
        en.plans.delete.inactive,
      ],
      [
        'gym',
        '/gyms/g1/delete',
        { '/api/gym-locations/g1': { ...GYM, isActive: false } },
        en.gyms.delete.inactive,
      ],
      [
        'gym subscription',
        '/gym-subscriptions/gs1/delete',
        {
          '/api/gym-subscriptions/gs1': {
            ...GYM_SUBSCRIPTION,
            isActive: false,
          },
        },
        en.gymSubscriptions.delete.inactive,
      ],
    ])(
      'an inactive %s cannot be deactivated again',
      async (_, url, loads, inactiveLabel) => {
        await open(url, loads);

        expect(button(inactiveLabel)!.disabled).toBe(true);
      },
    );

    it.each([
      [
        'trainer',
        '/trainers/tr1/delete',
        { '/api/trainers/tr1': { ...TRAINER, isActive: false } },
        en.trainers.delete.submit,
        '/api/trainers/tr1',
      ],
      [
        'trainee',
        '/trainees/t1/delete',
        { '/api/trainees/t1': { ...TRAINEE, isActive: false } },
        en.trainees.delete.submit,
        '/api/trainees/t1',
      ],
    ])(
      'an inactive %s can still be deactivated again',
      async (_, url, loads, label, deleteUrl) => {
        await open(url, loads);

        // CHARACTERIZATION: possibly unintended — unlike plans, gyms and gym cards, these pages don't
        // disable the button for an already-inactive record, so the DELETE is sent again.
        // TEST_NOTES.md S15.
        expect(button(label)!.disabled).toBe(false);
        button(label)!.click();
        await page.settle();
        http.expectOne(deleteUrl).flush({});
      },
    );
  });
});
