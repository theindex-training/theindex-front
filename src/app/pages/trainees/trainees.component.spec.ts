import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { TraineeProfile } from '../../services/trainees.service';
import { TraineesComponent } from './trainees.component';

const trainee = (overrides: Partial<TraineeProfile> = {}): TraineeProfile => ({
  id: 't1',
  name: 'Georgi Ivanov',
  nickname: 'Gosho',
  phone: '+359 888 214 503',
  accountId: null,
  gymSubscriptionId: null,
  isActive: true,
  ...overrides,
});

describe('TraineesComponent display helpers', () => {
  let component: TraineesComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    component = TestBed.createComponent(TraineesComponent).componentInstance;
    component.gymSubscriptions = [
      { id: 'gs1', name: 'Multisport', isActive: true },
    ];
  });

  it('formats nicknames in quotes, with a fallback', () => {
    expect(component.nicknameLabel(trainee())).toBe('“Gosho”');
    expect(component.nicknameLabel(trainee({ nickname: '  ' }))).toBe(
      'No nickname',
    );
  });

  it('resolves the gym card name, or null when missing/unknown', () => {
    expect(component.gymCardName(trainee({ gymSubscriptionId: 'gs1' }))).toBe(
      'Multisport',
    );
    expect(
      component.gymCardName(trainee({ gymSubscriptionId: 'unknown' })),
    ).toBeNull();
    expect(component.gymCardName(trainee())).toBeNull();
  });
});

describe('TraineesComponent list', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  const trainees = [
    trainee(),
    trainee({
      id: 't2',
      name: 'Ivan Petrov',
      nickname: null,
      gymSubscriptionId: 'gs1',
      accountId: 'acc2',
    }),
    trainee({
      id: 't3',
      name: 'Maria Koleva',
      nickname: 'Mimi',
    }),
  ];

  beforeEach(() => {
    localStorage.clear();
    signInAs('TRAINER');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function render(gymCards: 'ok' | 'error' = 'ok') {
    const fixture = TestBed.createComponent(TraineesComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    const cards = http.expectOne('/api/gym-subscriptions?includeInactive=true');
    if (gymCards === 'error') {
      const error = apiError(undefined, 500);
      cards.flush(error.body, error.options);
    } else {
      cards.flush([{ id: 'gs1', name: 'Multisport', isActive: true }]);
    }
    await flush('/api/trainees?active=true', trainees);
    return fixture.componentInstance;
  }

  async function flush(url: string, body: TraineeProfile[]) {
    http
      .expectOne((req) => req.method === 'GET' && req.urlWithParams === url)
      .flush(body);
    await page.settle();
  }

  const count = () =>
    page
      .query('[aria-live="polite"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

  it('loads only active trainees (deleted ones are gone) and every gym card', async () => {
    await render();

    expect(count()).toBe('3 of 3 trainees');
    expect(page.text()).toContain('Multisport');
    expect(page.text()).not.toContain(en.common.status);
    expect(page.text()).not.toContain(en.common.inactive);
  });

  it('filters by app account on the page, without asking the API', async () => {
    await render();
    const labels = page
      .queryAll('fieldset label')
      .map((label) => label.textContent?.trim());
    expect(labels).toEqual([
      en.common.all,
      en.common.accountFilter.withAccount,
      en.common.accountFilter.withoutAccount,
    ]);

    await page.click('input[type="radio"][value="withAccount"]');
    expect(count()).toBe('1 of 3 trainees');
    expect(page.text()).toContain('Ivan Petrov');
    expect(page.text()).not.toContain('Georgi Ivanov');

    await page.click('input[type="radio"][value="withoutAccount"]');
    expect(count()).toBe('2 of 3 trainees');
    expect(page.text()).not.toContain('Ivan Petrov');

    await page.click('input[type="radio"][value="all"]');
    expect(count()).toBe('3 of 3 trainees');
  });

  it('says when nobody matches the account filter, with a way back to everyone', async () => {
    const fixture = TestBed.createComponent(TraineesComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/gym-subscriptions?includeInactive=true').flush([]);
    await flush('/api/trainees?active=true', [trainee()]);

    await page.click('input[type="radio"][value="withAccount"]');
    expect(page.text()).toContain(en.trainees.list.noWithAccount);

    await page.click('app-empty-state button');
    expect(count()).toBe('1 of 1 trainee');
    expect(page.text()).toContain('Georgi Ivanov');
  });

  it('searches names and nicknames on the page, without asking the API', async () => {
    await render();

    await page.type('input[type="search"]', ' mimi ');
    expect(count()).toBe('1 of 3 trainees');

    await page.type('input[type="search"]', 'PETROV');
    expect(count()).toBe('1 of 3 trainees');
    expect(page.text()).toContain('Ivan Petrov');

    await page.type('input[type="search"]', 'zzz');
    expect(page.text()).toContain('No trainee matches “zzz”.');
    const clear = page.queryAll('app-empty-state button')[0];
    clear.click();
    await page.settle();
    expect(count()).toBe('3 of 3 trainees');
  });

  it('keeps the search applied when the filter changes', async () => {
    await render();
    await page.type('input[type="search"]', 'i');
    expect(count()).toBe('3 of 3 trainees');

    await page.click('input[type="radio"][value="withoutAccount"]');
    expect(count()).toBe('2 of 3 trainees');

    await page.type('input[type="search"]', 'petrov');
    expect(page.text()).toContain('No trainee matches “petrov”.');
  });

  it('still lists trainees when the gym cards fail to load', async () => {
    const component = await render('error');

    expect(count()).toBe('3 of 3 trainees');
    expect(component.gymCardName(trainees[1])).toBeNull();
  });

  it('shows the error state and reloads on "Try again"', async () => {
    const fixture = TestBed.createComponent(TraineesComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/gym-subscriptions?includeInactive=true').flush([]);
    const error = apiError('Database unavailable', 503);
    http
      .expectOne('/api/trainees?active=true')
      .flush(error.body, error.options);
    await page.settle();
    expect(page.text()).toContain('Database unavailable');

    await page.click('app-empty-state button');
    await flush('/api/trainees?active=true', []);
    expect(page.text()).toContain(en.trainees.list.emptyTitle);
  });
});
