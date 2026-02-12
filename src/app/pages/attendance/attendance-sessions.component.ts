import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AttendanceService,
  AttendanceSession,
  AttendanceSessionsQuery
} from '../../services/attendance.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

@Component({
  selector: 'app-attendance-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './attendance-sessions.component.html',
  styleUrl: './attendance-sessions.component.scss'
})
export class AttendanceSessionsComponent implements OnInit {
  sessions: AttendanceSession[] = [];
  trainers: TrainerProfile[] = [];

  selectedDate = this.todayIsoDate();
  selectedTrainerId = '';
  selectedBucketMinutes = 60;

  loading = true;
  loadingTrainers = true;
  errorMessage = '';

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly trainersService: TrainersService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrainers();
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';

    const query: AttendanceSessionsQuery = {
      date: this.selectedDate,
      bucketMinutes: this.selectedBucketMinutes
    };

    if (this.selectedTrainerId) {
      query.trainerId = this.selectedTrainerId;
    }

    this.attendanceService.sessions(query).subscribe({
      next: (response) => {
        this.sessions = response.sessions;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load attendance sessions right now.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  trackBySession(_: number, session: AttendanceSession): string {
    return session.sessionKey;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  formatTrainer(session: AttendanceSession): string {
    if (!session.trainer) {
      return '—';
    }

    return session.trainer.nickname
      ? `${session.trainer.name} (${session.trainer.nickname})`
      : session.trainer.name;
  }

  private loadTrainers(): void {
    this.loadingTrainers = true;

    this.trainersService.list(true).subscribe({
      next: (trainers) => {
        this.trainers = trainers.filter(item => item.isActive);
        this.loadingTrainers = false;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.loadingTrainers = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
