import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttendanceTraineeTrainingItem } from '../../services/attendance.service';
import { PageDriver, driver } from '../../../testing/dom';
import { TRAININGS_VIEW_STORAGE_KEY, TraineeTrainingsComponent } from './trainee-trainings.component';

const training: AttendanceTraineeTrainingItem = {
  id: 'a1',
  traineeId: 't1',
  trainerId: 'tr1',
  trainer: { id: 'tr1', name: 'Petar Ivanov', nickname: 'Pepi' },
  locationId: 'g1',
  location: { id: 'g1', name: 'Center' },
  trainedAt: '2026-10-30T16:30:00Z',
  subscriptionId: null,
  gymSubscriptionId: null,
  paymentStatus: 'PAID',
  createdAt: '2026-10-30T16:30:00Z'
};

describe('TraineeTrainingsComponent', () => {
  let fixture: ComponentFixture<TraineeTrainingsComponent>;
  let page: PageDriver;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-31T10:00:00Z') });
  });

  afterEach(() => vi.useRealTimers());

  async function render(trainings: AttendanceTraineeTrainingItem[] = [training]) {
    fixture = TestBed.createComponent(TraineeTrainingsComponent);
    fixture.componentRef.setInput('heading', 'Trainings');
    fixture.componentRef.setInput('subheading', 'Your completed trainings.');
    fixture.componentRef.setInput('headingId', 'my-trainings-title');
    fixture.componentRef.setInput('trainings', trainings);
    fixture.componentRef.setInput('emptyKey', 'traineeDashboard.noTrainings');
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
  }

  const radio = (label: string) =>
    page.queryAll<HTMLLabelElement>('label.segmented__option').find(item => item.textContent!.trim() === label)!
      .querySelector('input')!;
  const showsCalendar = () => page.query('app-trainings-calendar') !== null;
  const showsList = () => page.query('app-trainee-trainings-table') !== null;

  it('renders the heading with its id and a labelled Calendar / List switch', async () => {
    await render();

    expect(page.query('h2')!.id).toBe('my-trainings-title');
    expect(page.query('h2')!.textContent!.trim()).toBe('Trainings');
    expect(page.text()).toContain('Your completed trainings.');
    expect(page.query('legend')!.textContent!.trim()).toBe('Trainings view');
    expect(page.queryAll('label.segmented__option').map(item => item.textContent!.trim())).toEqual(['Calendar', 'List']);
  });

  it('shows the calendar by default, on the current month, with the trainings in it', async () => {
    await render();

    expect(radio('Calendar').checked).toBe(true);
    expect(showsCalendar()).toBe(true);
    expect(showsList()).toBe(false);
    expect(page.query('[data-testid="calendar-month"]')!.textContent!.trim()).toBe('October 2026');
    expect(page.query('[data-testid="calendar-day-2026-10-30"]')!.textContent).toContain('Pepi');
  });

  it('switches to the list and remembers the choice on this device', async () => {
    await render();

    await page.click('label.segmented__option:nth-of-type(2) input');
    expect(radio('List').checked).toBe(true);
    expect(showsList()).toBe(true);
    expect(showsCalendar()).toBe(false);
    expect(page.query('table caption')!.textContent!.trim()).toBe('Trainings');
    expect(localStorage.getItem(TRAININGS_VIEW_STORAGE_KEY)).toBe('list');

    await page.click('label.segmented__option:nth-of-type(1) input');
    expect(showsCalendar()).toBe(true);
    expect(localStorage.getItem(TRAININGS_VIEW_STORAGE_KEY)).toBe('calendar');
  });

  it('starts in the remembered view', async () => {
    localStorage.setItem(TRAININGS_VIEW_STORAGE_KEY, 'list');
    await render();

    expect(radio('List').checked).toBe(true);
    expect(showsList()).toBe(true);
  });

  it('falls back to the calendar for an unknown stored value', async () => {
    localStorage.setItem(TRAININGS_VIEW_STORAGE_KEY, 'agenda');
    await render();

    expect(showsCalendar()).toBe(true);
  });

  it('still works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await render();
    expect(showsCalendar()).toBe(true);

    await page.click('label.segmented__option:nth-of-type(2) input');
    expect(showsList()).toBe(true);
    vi.restoreAllMocks();
  });

  it('passes the empty message to both views', async () => {
    await render([]);
    expect(page.query('[data-testid="calendar-summary"]')!.textContent!.trim()).toBe('No trainings yet.');

    await page.click('label.segmented__option:nth-of-type(2) input');
    expect(page.query('p.notice')!.textContent!.trim()).toBe('No trainings yet.');
  });
});
