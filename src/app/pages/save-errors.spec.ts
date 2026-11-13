import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../testing/dom';
import { signInAs } from '../../testing/jwt';
import { GymSubscriptionCreateComponent } from './gym-subscriptions/gym-subscription-create.component';
import { GymSubscriptionDeleteComponent } from './gym-subscriptions/gym-subscription-delete.component';
import { GymSubscriptionEditComponent } from './gym-subscriptions/gym-subscription-edit.component';
import { GymCreateComponent } from './gyms/gym-create.component';
import { GymDeleteComponent } from './gyms/gym-delete.component';
import { GymEditComponent } from './gyms/gym-edit.component';
import { PlanCreateComponent } from './plans/plan-create.component';
import { PlanDeleteComponent } from './plans/plan-delete.component';
import { PlanEditComponent } from './plans/plan-edit.component';
import { TraineeCreateComponent } from './trainees/trainee-create.component';
import { TraineeDeleteComponent } from './trainees/trainee-delete.component';
import { TraineeEditComponent } from './trainees/trainee-edit.component';
import { TrainerCreateComponent } from './trainers/trainer-create.component';
import { TrainerDeleteComponent } from './trainers/trainer-delete.component';
import { TrainerEditComponent } from './trainers/trainer-edit.component';
import { TrainingTimeCreateComponent } from './training-times/training-time-create.component';
import { TrainingTimeDeleteComponent } from './training-times/training-time-delete.component';
import { TrainingTimeEditComponent } from './training-times/training-time-edit.component';

/**
 * A failed create, edit or delete must show the API's message and give the button back.
 * Regression test for TEST_NOTES.md S1: the app is zoneless, and these handlers used to update
 * their fields without re-rendering, so the error never appeared and the button stayed busy.
 * (Selling a subscription, the 19th handler, is covered in trainee-details.component.spec.ts.)
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
  address: null,
  notes: null,
  isActive: true,
};
const GYM_SUBSCRIPTION = { id: 'gs1', name: 'Sports card', isActive: true };
const TRAINING_TIME = { id: 'tt1', startTime: '18:00:00', endTime: '19:00:00' };
const TRAINER = {
  id: 'tr1',
  name: 'Petar',
  nickname: null,
  accountId: null,
  isActive: true,
};
const TRAINEE = {
  id: 't1',
  name: 'Ivan Petrov',
  nickname: null,
  phone: null,
  accountId: null,
  gymSubscriptionId: null,
  isActive: true,
};

interface Case {
  page: string;
  component: Type<unknown>;
  url: string;
  /** GETs the page makes on load, in any order: URL → response body. */
  loads?: Record<string, object>;
  /** Text fields to fill (selector → value) before saving. */
  fill?: Record<string, string>;
  /** Saving is a form submit, or a click on the button with this label (delete pages). */
  confirmLabel?: string;
  request: { method: 'POST' | 'PATCH' | 'DELETE'; url: string };
  busyLabel: string;
}

const cases: Case[] = [
  {
    page: 'plan create',
    component: PlanCreateComponent,
    url: '/plans/new',
    fill: { '#plan-title': 'Plan', '#plan-credits': '10', '#plan-price': '10' },
    request: { method: 'POST', url: '/api/plans' },
    busyLabel: en.common.saving,
  },
  {
    page: 'plan edit',
    component: PlanEditComponent,
    url: '/plans/p1/edit',
    loads: { '/api/plans/p1': PLAN },
    request: { method: 'PATCH', url: '/api/plans/p1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'plan deactivate',
    component: PlanDeleteComponent,
    url: '/plans/p1/delete',
    loads: { '/api/plans/p1': PLAN },
    confirmLabel: en.plans.delete.submit,
    request: { method: 'DELETE', url: '/api/plans/p1' },
    busyLabel: en.common.deactivating,
  },
  {
    page: 'gym create',
    component: GymCreateComponent,
    url: '/gyms/new',
    fill: { '#gym-name': 'Center' },
    request: { method: 'POST', url: '/api/gym-locations' },
    busyLabel: en.common.saving,
  },
  {
    page: 'gym edit',
    component: GymEditComponent,
    url: '/gyms/g1/edit',
    loads: { '/api/gym-locations/g1': GYM },
    request: { method: 'PATCH', url: '/api/gym-locations/g1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'gym deactivate',
    component: GymDeleteComponent,
    url: '/gyms/g1/delete',
    loads: { '/api/gym-locations/g1': GYM },
    confirmLabel: en.gyms.delete.submit,
    request: { method: 'DELETE', url: '/api/gym-locations/g1' },
    busyLabel: en.common.deactivating,
  },
  {
    page: 'gym subscription create',
    component: GymSubscriptionCreateComponent,
    url: '/gym-subscriptions/new',
    fill: { '#gym-subscription-name': 'Sports card' },
    request: { method: 'POST', url: '/api/gym-subscriptions' },
    busyLabel: en.common.saving,
  },
  {
    page: 'gym subscription edit',
    component: GymSubscriptionEditComponent,
    url: '/gym-subscriptions/gs1/edit',
    loads: { '/api/gym-subscriptions/gs1': GYM_SUBSCRIPTION },
    request: { method: 'PATCH', url: '/api/gym-subscriptions/gs1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'gym subscription deactivate',
    component: GymSubscriptionDeleteComponent,
    url: '/gym-subscriptions/gs1/delete',
    loads: { '/api/gym-subscriptions/gs1': GYM_SUBSCRIPTION },
    confirmLabel: en.gymSubscriptions.delete.submit,
    request: { method: 'DELETE', url: '/api/gym-subscriptions/gs1' },
    busyLabel: en.common.deactivating,
  },
  {
    page: 'training time create',
    component: TrainingTimeCreateComponent,
    url: '/training-times/new',
    fill: {
      '#training-time-start-time': '18:00',
      '#training-time-end-time': '19:00',
    },
    request: { method: 'POST', url: '/api/training-times' },
    busyLabel: en.common.saving,
  },
  {
    page: 'training time edit',
    component: TrainingTimeEditComponent,
    url: '/training-times/tt1/edit',
    loads: { '/api/training-times/tt1': TRAINING_TIME },
    request: { method: 'PATCH', url: '/api/training-times/tt1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'training time delete',
    component: TrainingTimeDeleteComponent,
    url: '/training-times/tt1/delete',
    loads: { '/api/training-times/tt1': TRAINING_TIME },
    confirmLabel: en.trainingTimes.delete.submit,
    request: { method: 'DELETE', url: '/api/training-times/tt1' },
    busyLabel: en.trainingTimes.delete.deleting,
  },
  {
    page: 'trainer create',
    component: TrainerCreateComponent,
    url: '/trainers/new',
    fill: { '#trainer-name': 'Petar' },
    request: { method: 'POST', url: '/api/trainers' },
    busyLabel: en.common.saving,
  },
  {
    page: 'trainer edit',
    component: TrainerEditComponent,
    url: '/trainers/tr1/edit',
    loads: { '/api/trainers/tr1': TRAINER },
    request: { method: 'PATCH', url: '/api/trainers/tr1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'trainer deactivate',
    component: TrainerDeleteComponent,
    url: '/trainers/tr1/delete',
    loads: { '/api/trainers/tr1': TRAINER },
    confirmLabel: en.trainers.delete.submit,
    request: { method: 'DELETE', url: '/api/trainers/tr1' },
    busyLabel: en.common.deactivating,
  },
  {
    page: 'trainee create',
    component: TraineeCreateComponent,
    url: '/trainees/new',
    loads: { '/api/gym-subscriptions': [] },
    fill: { '#trainee-name': 'Ivan Petrov' },
    request: { method: 'POST', url: '/api/trainees' },
    busyLabel: en.common.saving,
  },
  {
    page: 'trainee edit',
    component: TraineeEditComponent,
    url: '/trainees/t1/edit',
    loads: {
      '/api/gym-subscriptions?includeInactive=true': [],
      '/api/trainees/t1': TRAINEE,
    },
    request: { method: 'PATCH', url: '/api/trainees/t1' },
    busyLabel: en.common.saving,
  },
  {
    page: 'trainee deactivate',
    component: TraineeDeleteComponent,
    url: '/trainees/t1/delete',
    loads: { '/api/trainees/t1': TRAINEE },
    confirmLabel: en.trainees.delete.submit,
    request: { method: 'DELETE', url: '/api/trainees/t1' },
    busyLabel: en.common.deactivating,
  },
];

/** '/plans/p1/edit' → 'plans/:id/edit', so the page reads its id from the route as in the app. */
function routePath(url: string): string {
  return url
    .slice(1)
    .split('/')
    .map((segment, index) =>
      index === 1 && segment !== 'new' ? ':id' : segment,
    )
    .join('/');
}

describe('a failed save shows the error and gives the button back', () => {
  let http: HttpTestingController;
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
          ...cases.map(({ url, component }) => ({
            path: routePath(url),
            component,
          })),
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const busyButton = (label: string) =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((button) => button.textContent?.trim() === label);

  it.each(cases.map((testCase) => [testCase.page, testCase] as const))(
    '%s',
    async (_, testCase) => {
      await harness.navigateByUrl(testCase.url, testCase.component);
      page = driver(
        () => harness.routeNativeElement!,
        () => harness.fixture.whenStable(),
      );
      for (const [url, body] of Object.entries(testCase.loads ?? {})) {
        http.expectOne(url).flush(body);
      }
      await page.settle();
      // The trainee and trainer forms load the gyms for their home gym field once they show.
      const gyms = http.match('/api/gym-locations?includeInactive=true');
      gyms.forEach((request) => request.flush([GYM]));
      if (gyms.length) {
        await page.settle();
      }

      for (const [selector, value] of Object.entries(testCase.fill ?? {})) {
        await page.type(selector, value);
      }
      if (testCase.confirmLabel) {
        page
          .queryAll('button')
          .find(
            (button) => button.textContent?.trim() === testCase.confirmLabel,
          )!
          .click();
        await page.settle();
      } else {
        await page.submit();
      }

      const button = busyButton(testCase.busyLabel);
      expect(button?.disabled, 'button is busy while saving').toBe(true);

      const req = http.expectOne(testCase.request.url);
      expect(req.request.method).toBe(testCase.request.method);
      const error = apiError('Something went wrong on the server', 409);
      req.flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe('Something went wrong on the server');
      expect(button!.disabled).toBe(false);
      expect(button!.textContent?.trim()).not.toBe(testCase.busyLabel);
      expect(harness.routeNativeElement).toBeTruthy();
    },
  );
});
