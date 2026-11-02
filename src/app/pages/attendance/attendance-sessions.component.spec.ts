import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import {
  AttendanceSession,
  AttendanceSessionAttendanceItem,
  AttendanceSessionsResponse
} from '../../services/attendance.service';
import { AttendanceSessionsComponent } from './attendance-sessions.component';

const copy = en.attendance.sessions;
// 00:30 on 2 Nov in Sofia; the default range is 7 days back to today, in local dates.
const NOW = new Date('2026-11-01T22:30:00Z');
const DEFAULT_RANGE = 'startDate=2026-10-26&endDate=2026-11-02';

function attendee(
  id: string,
  traineeId: string,
  paymentStatus: 'PAID' | 'UNPAID',
  priceCents: number,
  isFinal: boolean
): AttendanceSessionAttendanceItem {
  return {
    id,
    trainedAt: '2026-11-01T16:30:00Z',
    paymentStatus,
    traineeId,
    subscriptionId: null,
    price: { priceCents, calculation: 'test', subscriptionType: 'PUNCH', isFinal }
  };
}

function session(key: string, trainerId: string, start: string, attendance: AttendanceSessionAttendanceItem[]): AttendanceSession {
  return {
    sessionKey: key,
    date: start.slice(0, 10),
    start,
    end: start.replace(/T(\d\d)/, (_, hour) => `T${String(Number(hour) + 1).padStart(2, '0')}`),
    trainerId,
    locationId: 'gym-1',
    attendance,
    totals: {
      count: attendance.length,
      paid: attendance.filter(item => item.paymentStatus === 'PAID').length,
      unpaid: attendance.filter(item => item.paymentStatus === 'UNPAID').length
    }
  };
}

function response(): AttendanceSessionsResponse {
  return {
    filters: { startDate: '2026-10-26', endDate: '2026-11-02', startTime: '', endTime: '', trainerId: null },
    sessions: [
      session('mine', 'trainer-1', '2026-11-01T16:30:00Z', [
        attendee('a1', 'ivan', 'PAID', 450, true),
        attendee('a2', 'georgi', 'UNPAID', 999, false)
      ]),
      session('other', 'trainer-other', '2026-10-30T06:00:00Z', [attendee('a3', 'ivan', 'PAID', 600, true)])
    ],
    entities: {
      trainees: [
        { id: 'ivan', name: 'Ivan Petrov', nickname: 'Vanko' },
        { id: 'georgi', name: 'Georgi Dimitrov', nickname: null }
      ],
      trainers: [
        { id: 'trainer-1', name: 'Petar', nickname: 'Pepi' },
        { id: 'trainer-other', name: 'Maria', nickname: null }
      ],
      locations: [{ id: 'gym-1', name: 'Center' }]
    }
  };
}

describe('AttendanceSessionsComponent', () => {
  let fixture: ComponentFixture<AttendanceSessionsComponent>;
  let component: AttendanceSessionsComponent;
  let http: HttpTestingController;
  let page: PageDriver;
  let format: LocaleFormatService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AttendanceSessionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
    format = TestBed.inject(LocaleFormatService);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function render() {
    fixture = TestBed.createComponent(AttendanceSessionsComponent);
    component = fixture.componentInstance;
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
  }

  async function flushSessions(url: string, body: AttendanceSessionsResponse = response()) {
    const req = http.expectOne(`/api/attendance/sessions?${url}`);
    expect(req.request.method).toBe('GET');
    req.flush(body);
    await page.settle();
  }

  const chips = () => page.queryAll('button[aria-pressed]');
  const pressed = () => chips().map(chip => chip.getAttribute('aria-pressed'));
  const summary = () =>
    page
      .queryAll(`dl[aria-label="${copy.summaryLabel}"] dd`)
      .map(dd => dd.textContent!.trim());
  const deleteButtons = (name: string) =>
    page.queryAll<HTMLButtonElement>(`button[aria-label="Delete attendance for ${name}"]`);
  const apply = () => page.queryAll('button').find(button => button.textContent?.trim() === copy.apply)!;

  async function toggle(index: number) {
    chips()[index].click();
    await page.settle();
  }

  describe('as an admin', () => {
    beforeEach(async () => {
      signInAs('ADMIN');
      await render();
      http
        .expectOne('/api/trainers?active=true')
        .flush([
          { id: 'trainer-1', name: 'Petar', nickname: 'Pepi', accountId: null, isActive: true },
          { id: 'trainer-gone', name: 'Gone', nickname: null, accountId: null, isActive: false }
        ]);
      await flushSessions(DEFAULT_RANGE);
    });

    it('loads the last 7 days for every trainer and selects every session', () => {
      expect(pressed()).toEqual(['true', 'true']);
      expect(summary()).toEqual(['2', '3', '2', '1', format.money(1050)]);
    });

    it('prices each session from final prices only and shows "—" for a price not final yet', () => {
      expect(page.text()).toContain(`${copy.priceTotal} ${format.money(450)}`);
      expect(page.text()).toContain(`${copy.priceTotal} ${format.money(600)}`);
      expect(component.attendancePrice(component.sessions[0].attendance[1])).toBe('—');
      expect(component.attendancePrice(component.sessions[0].attendance[0])).toBe(format.money(450));
    });

    it('offers only active trainers in the filter', () => {
      const options = page.queryAll<HTMLOptionElement>('select option').map(option => option.value);
      expect(options).toEqual(['', 'trainer-1']);
    });

    it('labels sessions by date, time and trainer nickname (or name)', () => {
      expect(chips()[0].textContent).toContain(
        `${format.shortDate('2026-11-01T16:30:00Z')} · ${format.clock('2026-11-01T16:30:00Z')}–${format.clock('2026-11-01T17:30:00Z')}, Pepi`
      );
      expect(chips()[1].textContent).toContain(', Maria');
      expect(page.text()).toContain('Petar (Pepi)');
      expect(component.formatTrainer(component.sessions[1])).toBe('Maria');
      expect(component.formatTrainerNickname('unknown')).toBe('—');
      expect(component.formatTrainer({ ...component.sessions[1], trainerId: 'unknown' })).toBe('—');
      expect(component.traineeName('unknown')).toBe('—');
      expect(component.traineeNickname('georgi')).toBe('—');
      expect(component.locationName('unknown')).toBe('—');
    });

    it('updates the summary as sessions are toggled, counting only final prices', async () => {
      await toggle(1);
      expect(pressed()).toEqual(['true', 'false']);
      expect(summary()).toEqual(['1', '2', '1', '1', format.money(450)]);

      await toggle(0);
      expect(summary()).toEqual([]);
      expect(page.text()).toContain(copy.selectHint);
    });

    it('keeps the selection across a reload, or selects everything when nothing survives', async () => {
      await toggle(1);
      apply().click();
      await page.settle();
      await flushSessions(DEFAULT_RANGE);
      expect(pressed()).toEqual(['true', 'false']);

      await toggle(0);
      apply().click();
      await page.settle();
      await flushSessions(DEFAULT_RANGE);
      expect(pressed()).toEqual(['true', 'true']);
    });

    it('sends the time window and trainer only when they are set', async () => {
      const [from, to] = page.queryAll<HTMLInputElement>('input[type="date"]');
      from.value = '2026-10-01';
      from.dispatchEvent(new Event('input'));
      to.value = '2026-10-31';
      to.dispatchEvent(new Event('input'));
      await page.type('input[type="time"]', '18:00');
      await page.select('select', 'trainer-1');
      apply().click();
      await page.settle();

      await flushSessions('startDate=2026-10-01&endDate=2026-10-31&startTime=18:00&trainerId=trainer-1');
    });

    it('can delete attendance in any session', () => {
      expect(deleteButtons('Ivan Petrov').length).toBe(4); // table + phone list, in both sessions
      expect(deleteButtons('Georgi Dimitrov').length).toBe(2);
    });

    it('asks before deleting and does nothing when cancelled', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      deleteButtons('Georgi Dimitrov')[0].click();
      await page.settle();

      expect(confirm).toHaveBeenCalledWith(
        `Delete attendance for Georgi Dimitrov at ${format.date('2026-11-01T16:30:00Z')} · ${format.clock('2026-11-01T16:30:00Z')}?`
      );
      http.expectNone(req => req.method === 'DELETE');
    });

    it('deletes the attendance, removes the row and recounts the session', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      deleteButtons('Georgi Dimitrov')[0].click();
      await page.settle();
      const req = http.expectOne('/api/attendance/a2');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await page.settle();

      expect(deleteButtons('Georgi Dimitrov').length).toBe(0);
      expect(component.sessions[0].totals).toEqual({ count: 1, paid: 1, unpaid: 0 });
      expect(summary()).toEqual(['2', '2', '2', '0', format.money(1050)]);
    });

    it('ignores another delete while one is in progress', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      deleteButtons('Georgi Dimitrov')[0].click();
      deleteButtons('Ivan Petrov')[0].click();
      await page.settle();

      http.expectOne('/api/attendance/a2').flush(null);
      http.expectNone('/api/attendance/a1');
      await page.settle();
    });

    it('keeps the sessions and shows the error when a delete fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      deleteButtons('Ivan Petrov')[0].click();
      await page.settle();
      const error = apiError('Attendance is part of a final settlement', 409);
      http.expectOne('/api/attendance/a1').flush(error.body, error.options);
      await page.settle();

      expect(page.alert()).toBe('Attendance is part of a final settlement');
      expect(deleteButtons('Ivan Petrov').length).toBe(4);
    });
  });

  describe('as a trainer', () => {
    it('always loads their own sessions and has no trainer filter', async () => {
      signInAs('TRAINER', { trainerProfileId: 'trainer-1' });
      await render();

      http.expectNone(req => req.url.startsWith('/api/trainers'));
      await flushSessions(`${DEFAULT_RANGE}&trainerId=trainer-1`);
      expect(page.query('select')).toBeNull();
    });

    it('can delete only in their own sessions', async () => {
      signInAs('TRAINER', { trainerProfileId: 'trainer-1' });
      await render();
      await flushSessions(`${DEFAULT_RANGE}&trainerId=trainer-1`);

      expect(deleteButtons('Ivan Petrov').length).toBe(2); // only in session "mine"
      expect(deleteButtons('Georgi Dimitrov').length).toBe(2);
    });

    it('without a trainer profile, loads every trainer\'s sessions but can delete nothing', async () => {
      signInAs('TRAINER', { trainerProfileId: null });
      await render();

      // CHARACTERIZATION: possibly unintended — with no trainerProfileId the trainerId filter is
      // dropped, so this trainer sees everyone's sessions. TEST_NOTES.md S9.
      await flushSessions(DEFAULT_RANGE);
      expect(chips().length).toBe(2);
      expect(deleteButtons('Ivan Petrov').length).toBe(0);
    });
  });

  it('shows the error state and retries', async () => {
    signInAs('TRAINER');
    await render();
    const error = apiError(undefined, 500);
    http.expectOne(`/api/attendance/sessions?${DEFAULT_RANGE}&trainerId=trainer-1`).flush(error.body, error.options);
    await page.settle();

    expect(page.text()).toContain(copy.loadError);
    page.queryAll('button').find(button => button.textContent?.trim() === en.common.tryAgain)!.click();
    await page.settle();
    await flushSessions(`${DEFAULT_RANGE}&trainerId=trainer-1`, { ...response(), sessions: [] });

    expect(page.text()).toContain(copy.emptyTitle);
  });
});
