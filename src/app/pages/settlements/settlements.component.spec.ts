import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
  { id: 's1', periodStart: '2026-10-01', periodEnd: '2026-10-31', generatedAt: '2026-11-01T09:00:00Z', status: 'DRAFT', notes: null },
  { id: 's2', periodStart: '2026-09-01', periodEnd: '2026-09-30', generatedAt: '2026-10-01T09:00:00Z', status: 'FINAL', notes: null }
];

describe('SettlementsComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let component: SettlementsComponent;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function render(role: 'ADMIN' | 'TRAINER', settlements: Settlement[] = SETTLEMENTS) {
    signInAs(role);
    const fixture = TestBed.createComponent(SettlementsComponent);
    component = fixture.componentInstance;
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
    http.expectOne('/api/settlements').flush(settlements);
    await page.settle();
  }

  const deleteButtons = () => page.queryAll<HTMLButtonElement>('button[aria-label^="Delete settlement"]');
  const generateLinks = () => page.queryAll('a').filter(link => link.textContent?.trim() === copy.generate);

  it('lets an admin generate and delete settlements', async () => {
    await render('ADMIN');

    expect(generateLinks().length).toBeGreaterThan(0);
    expect(deleteButtons().length).toBe(4); // two settlements, table + phone list
  });

  it('gives a trainer a read-only list', async () => {
    await render('TRAINER');

    expect(generateLinks().length).toBe(0);
    expect(deleteButtons().length).toBe(0);
    component.deleteSettlement(SETTLEMENTS[0]);
    http.expectNone('/api/settlements/s1');
  });

  it('tells each role what to do when there are no settlements yet', async () => {
    await render('TRAINER', []);
    expect(page.text()).toContain(copy.emptyTrainer);
  });

  it('asks before deleting, naming the period, and does nothing when cancelled', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await render('ADMIN');
    const format = TestBed.inject(LocaleFormatService);

    deleteButtons()[0].click();
    await page.settle();

    expect(confirm).toHaveBeenCalledWith(
      `Delete settlement for ${format.date('2026-10-01')} to ${format.date('2026-10-31')}?`
    );
    http.expectNone('/api/settlements/s1');
  });

  it('deletes the settlement and removes it from the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render('ADMIN');

    deleteButtons()[0].click();
    await page.settle();
    const req = http.expectOne('/api/settlements/s1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    await page.settle();

    expect(component.settlements.map(item => item.id)).toEqual(['s2']);
    expect(deleteButtons().length).toBe(2);
  });

  it('ignores a second delete while one is in progress', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render('ADMIN');

    component.deleteSettlement(SETTLEMENTS[0]);
    component.deleteSettlement(SETTLEMENTS[1]);

    http.expectOne('/api/settlements/s1').flush(null);
    http.expectNone('/api/settlements/s2');
  });

  it('keeps the list and shows a notice when a delete fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render('ADMIN');

    deleteButtons()[0].click();
    await page.settle();
    const error = apiError('Settlement is final', 409);
    http.expectOne('/api/settlements/s1').flush(error.body, error.options);
    await page.settle();

    expect(page.alert()).toBe('Settlement is final');
    expect(deleteButtons().length).toBe(4);
  });

  it('shows the error state and reloads on "Try again"', async () => {
    signInAs('ADMIN');
    const fixture = TestBed.createComponent(SettlementsComponent);
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
    const error = apiError(undefined, 500);
    http.expectOne('/api/settlements').flush(error.body, error.options);
    await page.settle();
    expect(page.text()).toContain(copy.loadErrorMessage);

    await page.click('app-empty-state button');
    http.expectOne('/api/settlements').flush([]);
    await page.settle();
    expect(page.text()).toContain(copy.emptyAdmin);
  });
});
