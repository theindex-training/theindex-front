import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TraineeDashboardComponent } from '../trainee-dashboard/trainee-dashboard.component';
import { StaffDashboardComponent } from './staff-dashboard.component';

/**
 * Everyone's start page (`/home`): the dashboard of the signed-in person's role. Trainees get
 * theirs (their subscription, today's and tomorrow's trainings to book, their attendance), staff
 * theirs (the trainings to register, what is waiting, shortcuts).
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [StaffDashboardComponent, TraineeDashboardComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (trainee) {
      <app-trainee-dashboard />
    } @else {
      <app-staff-dashboard />
    }
  `,
})
export class HomeComponent {
  readonly trainee = inject(AuthService).getUserRole() === 'TRAINEE';
}
