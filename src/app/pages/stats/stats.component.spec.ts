import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import bg from '../../../../public/i18n/bg.json';
import en from '../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../testing/dom';
import { signInAs } from '../../../testing/jwt';
import { LanguageService } from '../../i18n/language.service';
import { TraineeTrainingInsights } from '../../services/trainees.service';
import { StatsComponent } from './stats.component';

const INSIGHTS: TraineeTrainingInsights = {
  traineeId: 'trainee-1',
  totalAttendances: 30,
  topTrainingPartners: [{ traineeId: 't2', traineeName: 'Georgi', trainingsTogether: 12 }],
  topTrainers: [{ trainerId: 'tr1', trainerName: 'Petar', trainingsCount: 20 }],
  topGyms: [{ gymId: 'g1', gymName: 'Center', trainingsCount: 25 }],
  topWeekdays: [
    { weekday: 'Monday', weekdayNumber: 1, trainingsCount: 10 },
    { weekday: 'Sunday', weekdayNumber: 7, trainingsCount: 3 },
    { weekday: 'Someday', weekdayNumber: 0, trainingsCount: 1 }
  ],
  topTimeSlots: [{ timeSlot: '18:00', trainingsCount: 15 }]
};

describe('StatsComponent', () => {
  let http: HttpTestingController;
  let page: PageDriver;
  let component: StatsComponent;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('TRAINEE');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StatsComponent);
    component = fixture.componentInstance;
    page = driver(() => fixture.nativeElement, () => fixture.whenStable());
    await page.settle();
  });

  afterEach(() => http.verify());

  it('loads the signed-in trainee\'s insights into the ranked lists', async () => {
    http.expectOne('/api/trainees/me/training-insights').flush(INSIGHTS);
    await page.settle();

    expect(component.partners).toEqual([{ label: 'Georgi', value: 12 }]);
    expect(component.trainers).toEqual([{ label: 'Petar', value: 20 }]);
    expect(component.gyms).toEqual([{ label: 'Center', value: 25 }]);
    expect(component.timeSlots).toEqual([{ label: '18:00', value: 15 }]);
    expect(page.text()).toContain('Georgi');
    expect(page.text()).toContain('20 trainings');
  });

  it('names weekdays from their number in the active language, or keeps the API name', async () => {
    http.expectOne('/api/trainees/me/training-insights').flush(INSIGHTS);
    await page.settle();

    expect(component.weekdays.map(item => item.label)).toEqual(['Monday', 'Sunday', 'Someday']);

    TestBed.inject(LanguageService).use('bg').subscribe();
    expect(component.weekdays.map(item => item.label)).toEqual(['Понеделник', 'Неделя', 'Someday']);
    expect(bg.stats).toBeDefined();
  });

  it('shows empty lists before anything is loaded', () => {
    expect(component.partners).toEqual([]);
    expect(component.weekdays).toEqual([]);
    http.expectOne('/api/trainees/me/training-insights').flush(INSIGHTS);
  });

  it('shows the API error or the fallback', async () => {
    const error = apiError(undefined, 500);
    http.expectOne('/api/trainees/me/training-insights').flush(error.body, error.options);
    await page.settle();

    expect(page.text()).toContain(en.stats.loadErrorMessage);
  });
});
