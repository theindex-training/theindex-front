import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../testing/dom';
import { signInAs } from '../../testing/jwt';
import { LocaleFormatService } from '../i18n/locale-format.service';
import { GymSubscriptionsComponent } from './gym-subscriptions/gym-subscriptions.component';
import { GymsComponent } from './gyms/gyms.component';
import { PlansComponent } from './plans/plans.component';
import { TrainersComponent } from './trainers/trainers.component';
import { TrainingTimesComponent } from './training-times/training-times.component';

/** The catalog list pages (TEST_PLAN.md §7). The trainees list has its own spec. */
describe('catalog lists', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render<T>(component: Type<T>) {
    const fixture = TestBed.createComponent(component);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    return fixture.componentInstance;
  }

  async function flush(url: string, body: object) {
    const req = http.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    await page.settle();
  }

  async function filter(value: 'all' | 'active' | 'inactive') {
    await page.click(`input[type="radio"][value="${value}"]`);
  }

  const count = () =>
    page
      .query('[aria-live="polite"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

  describe('plans', () => {
    const plans = [
      {
        id: 'p1',
        type: 'PUNCH',
        title: '10 visits',
        priceCents: 4550,
        credits: 10,
        durationDays: null,
        isActive: true,
      },
      {
        id: 'p2',
        type: 'TIME',
        title: 'Monthly',
        priceCents: 6000,
        credits: null,
        durationDays: 1,
        isActive: false,
      },
    ];

    it('maps the status filter to the active param', async () => {
      await render(PlansComponent);
      await flush('/api/plans', plans);

      await filter('active');
      await flush('/api/plans?active=true', [plans[0]]);
      await filter('inactive');
      await flush('/api/plans?active=false', [plans[1]]);
      await filter('all');
      await flush('/api/plans', plans);

      expect(count()).toBe('2 plans');
    });

    it('describes each plan by credits or days, and its price', async () => {
      const component = await render(PlansComponent);
      await flush('/api/plans', plans);
      const format = TestBed.inject(LocaleFormatService);

      expect(component.formatPlanDetails(plans[0] as never)).toBe('10 credits');
      expect(component.formatPlanDetails(plans[1] as never)).toBe('1 day');
      expect(
        component.formatPlanDetails({ ...plans[0], credits: null } as never),
      ).toBe('0 credits');
      expect(page.text()).toContain(format.money(4550));
    });

    it('shows the error state and reloads on "Try again"', async () => {
      await render(PlansComponent);
      const error = apiError(undefined, 500);
      http.expectOne('/api/plans').flush(error.body, error.options);
      await page.settle();
      expect(page.text()).toContain(en.plans.list.loadErrorMessage);

      await page.click('app-empty-state button');
      await flush('/api/plans', []);

      expect(page.text()).toContain(en.plans.list.emptyTitle);
    });
  });

  describe.each([
    ['gyms', GymsComponent, '/api/gym-locations', 'Center', 'Old gym'],
    [
      'gym subscriptions',
      GymSubscriptionsComponent,
      '/api/gym-subscriptions',
      'Sports card',
      'Old card',
    ],
  ])('%s', (_, component, url, activeName, inactiveName) => {
    const items = [
      { id: 'a', name: activeName, address: null, notes: null, isActive: true },
      {
        id: 'b',
        name: inactiveName,
        address: 'Side St',
        notes: null,
        isActive: false,
      },
    ];

    it('loads everything for "All", and only active ones for "Active"', async () => {
      await render(component as Type<unknown>);
      await flush(`${url}?includeInactive=true`, items);
      expect(page.text()).toContain(inactiveName);

      await filter('active');
      await flush(`${url}?includeInactive=false`, [items[0]]);
      expect(page.text()).not.toContain(inactiveName);
    });

    it('"Inactive" loads everything and keeps only the inactive ones', async () => {
      await render(component as Type<unknown>);
      await flush(`${url}?includeInactive=true`, items);

      await filter('inactive');
      await flush(`${url}?includeInactive=true`, items);

      expect(page.text()).toContain(inactiveName);
      expect(page.text()).not.toContain(activeName);
    });
  });

  it('gyms show a dash for a missing address', async () => {
    const component = await render(GymsComponent);
    await flush('/api/gym-locations?includeInactive=true', []);

    expect(
      component.formatAddress({
        id: 'g',
        name: 'G',
        address: '  ',
        notes: null,
        isActive: true,
      }),
    ).toBe('—');
  });

  it('training times are listed as HH:mm', async () => {
    await render(TrainingTimesComponent);
    await flush('/api/training-times', [
      { id: 'tt1', startTime: '8:00:00', endTime: '09:30:00' },
    ]);

    expect(page.text()).toContain('08:00');
    expect(page.text()).toContain('09:30');
    expect(page.text()).not.toContain(':00:00');
  });

  describe('trainers', () => {
    const trainers = [
      {
        id: 'tr1',
        name: 'Petar Petrov',
        nickname: 'Pepi',
        accountId: 'acc1',
        isActive: true,
      },
      {
        id: 'tr2',
        name: 'Maria Koleva',
        nickname: null,
        accountId: null,
        isActive: true,
      },
    ];

    it('maps the status filter to the active param', async () => {
      await render(TrainersComponent);
      await flush('/api/trainers', trainers);

      await filter('inactive');
      await flush('/api/trainers?active=false', []);
      await filter('active');
      await flush('/api/trainers?active=true', trainers);
    });

    it('searches names and nicknames on the page, and clears the search', async () => {
      await render(TrainersComponent);
      await flush('/api/trainers', trainers);
      expect(count()).toBe('2 of 2 trainers');

      await page.type('input[type="search"]', ' PEPI ');
      expect(count()).toBe('1 of 2 trainers');
      expect(page.text()).not.toContain('Maria Koleva');

      await page.type('input[type="search"]', 'nobody');
      expect(page.text()).toContain('No trainer matches “nobody”.');

      await page.click(`button[aria-label="${en.common.clearSearch}"]`);
      expect(count()).toBe('2 of 2 trainers');
    });

    it('keeps the search applied when the filter changes', async () => {
      await render(TrainersComponent);
      await flush('/api/trainers', trainers);
      await page.type('input[type="search"]', 'maria');

      await filter('active');
      await flush('/api/trainers?active=true', trainers);

      expect(count()).toBe('1 of 2 trainers');
    });

    it('labels nicknames and linked accounts', async () => {
      const component = await render(TrainersComponent);
      await flush('/api/trainers', trainers);

      expect(component.nicknameLabel(trainers[0])).toBe('“Pepi”');
      expect(component.nicknameLabel(trainers[1])).toBe(en.common.noNickname);
      expect(component.hasLinkedAccount(trainers[0])).toBe(true);
      expect(component.hasLinkedAccount(trainers[1])).toBe(false);
    });
  });
});
