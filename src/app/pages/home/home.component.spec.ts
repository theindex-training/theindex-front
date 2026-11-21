import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TestRole, signInAs } from '../../../testing/jwt';
import { HomeComponent } from './home.component';

/** `/home` is every role's start page; it shows the role's dashboard. */
describe('HomeComponent', () => {
  let http: HttpTestingController;

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

  async function render(role: TestRole) {
    signInAs(role, { traineeProfileId: 'trainee-1' });
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a trainee their own dashboard', async () => {
    const el = await render('TRAINEE');

    expect(el.querySelector('app-trainee-dashboard')).not.toBeNull();
    expect(el.querySelector('app-staff-dashboard')).toBeNull();
    http.expectOne('/api/bookings/gyms');
    http.expectNone((req) => req.url === '/api/schedules/slots');
  });

  it.each(['ADMIN', 'TRAINER'] as const)(
    'shows a %s the staff dashboard',
    async (role) => {
      const el = await render(role);

      expect(el.querySelector('app-staff-dashboard')).not.toBeNull();
      expect(el.querySelector('app-trainee-dashboard')).toBeNull();
      http.expectOne((req) => req.url === '/api/schedules/slots');
      http.expectNone('/api/bookings/gyms');
    },
  );
});
