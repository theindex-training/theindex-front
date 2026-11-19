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
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { Settlement } from '../../services/settlements.service';
import { SettlementsComponent } from './settlements.component';

const copy = en.settlements.list;
const SETTLEMENTS: Settlement[] = [
  {
    id: 's1',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    generatedAt: '2026-11-01T09:00:00Z',
    status: 'DRAFT',
    finalizedAt: null,
    notes: null,
  },
  {
    id: 's2',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    generatedAt: '2026-10-01T09:00:00Z',
    status: 'FINAL',
    finalizedAt: '2026-10-02T09:00:00Z',
    notes: null,
  },
];

describe('SettlementsComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function render(
    role: 'ADMIN' | 'TRAINER',
    settlements: Settlement[] = SETTLEMENTS,
  ) {
    signInAs(role);
    const fixture = TestBed.createComponent(SettlementsComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    http.expectOne('/api/settlements').flush(settlements);
    await page.settle();
  }

  it('lists every report with its period, creation time and status, linked to its page', async () => {
    await render('ADMIN');
    const format = TestBed.inject(LocaleFormatService);

    const text = page.text();
    expect(text).toContain(format.date('2026-10-01'));
    expect(text).toContain(format.dateTime('2026-11-01T09:00:00Z'));
    expect(text).toContain(en.enums.settlementStatus.DRAFT);
    expect(text).toContain(en.enums.settlementStatus.FINAL);
    const links = page
      .queryAll<HTMLAnchorElement>('a.cell-link')
      .map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/settlements/s1', '/settlements/s2']);
  });

  it.each(['ADMIN', 'TRAINER'] as const)(
    'offers %s no way to create or delete a report: only links to the reports',
    async (role) => {
      await render(role);

      expect(page.queryAll('button')).toEqual([]);
      const hrefs = page
        .queryAll<HTMLAnchorElement>('a')
        .map((a) => a.getAttribute('href'));
      expect(new Set(hrefs)).toEqual(
        new Set(['/settlements/s1', '/settlements/s2']),
      );
    },
  );

  it('explains that reports are created automatically when there are none yet', async () => {
    await render('ADMIN', []);
    expect(page.text()).toContain(copy.emptyMessage);
  });

  it('shows the error state and reloads on "Try again"', async () => {
    signInAs('ADMIN');
    const fixture = TestBed.createComponent(SettlementsComponent);
    page = driver(
      () => fixture.nativeElement,
      () => fixture.whenStable(),
    );
    await page.settle();
    const error = apiError(undefined, 500);
    http.expectOne('/api/settlements').flush(error.body, error.options);
    await page.settle();
    expect(page.text()).toContain(copy.loadErrorMessage);

    await page.click('app-empty-state button');
    http.expectOne('/api/settlements').flush([]);
    await page.settle();
    expect(page.text()).toContain(copy.emptyMessage);
  });
});
