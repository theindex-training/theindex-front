import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  AttendanceService,
  AttendanceTraineeTrainingItem,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-trainee-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trainee-dashboard.component.html',
  styleUrl: './trainee-dashboard.component.scss',
})
export class TraineeDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';
  paidTrainings: AttendanceTraineeTrainingItem[] = [];
  unpaidTrainings: AttendanceTraineeTrainingItem[] = [];

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadTrainings();
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  trackByTraining(_: number, item: AttendanceTraineeTrainingItem): string {
    return item.id;
  }

  private loadTrainings(): void {
    const traineeId = this.authService.getTraineeProfileId();

    if (!traineeId) {
      this.errorMessage = 'Unable to load your trainings. Missing trainee profile identifier.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      paid: this.attendanceService.listPaidForTrainee(traineeId),
      unpaid: this.attendanceService.listUnpaidForTrainee(traineeId),
    }).subscribe({
      next: ({ paid, unpaid }) => {
        this.paidTrainings = paid;
        this.unpaidTrainings = unpaid;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load your trainings right now. Please try again later.';
        this.loading = false;
      },
    });
  }
}
