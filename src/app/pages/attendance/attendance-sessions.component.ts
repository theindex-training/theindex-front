import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AttendanceListItem,
  AttendanceService,
  AttendanceSession,
  AttendanceSessionAttendanceItem,
  AttendanceSessionsQuery
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
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
  deletingAttendanceId: string | null = null;
  readonly canDeleteAttendance: boolean;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly trainersService: TrainersService,
    private readonly authService: AuthService,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    const userRole = this.authService.getUserRole();
    this.canDeleteAttendance = userRole === 'ADMIN' || userRole === 'TRAINER';
  }

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

    forkJoin({
      sessionsResponse: this.attendanceService.sessions(query),
      listItems: this.attendanceService.list({
        date: this.selectedDate,
        ...(this.selectedTrainerId ? { trainerId: this.selectedTrainerId } : {})
      })
    }).subscribe({
      next: ({ sessionsResponse, listItems }) => {
        const sessionLocationMap = this.buildSessionLocationMap(listItems, this.selectedBucketMinutes);

        this.sessions = sessionsResponse.sessions.map(session => ({
          ...session,
          location:
            session.location ||
            sessionLocationMap.get(session.sessionKey) ||
            sessionLocationMap.get(this.computeSessionKey(new Date(session.start), session.bucketMinutes)) ||
            null
        }));

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

  deleteAttendance(session: AttendanceSession, item: AttendanceSessionAttendanceItem): void {
    if (!this.canDeleteAttendance || this.deletingAttendanceId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete attendance for ${item.trainee.name} at ${this.formatDateTime(item.trainedAt)}?`
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = '';
    this.deletingAttendanceId = item.id;

    this.attendanceService.deleteById(item.id).subscribe({
      next: () => {
        session.attendance = session.attendance.filter(attendance => attendance.id !== item.id);
        session.totals = {
          count: session.attendance.length,
          paid: session.attendance.filter(attendance => attendance.paymentStatus === 'PAID').length,
          unpaid: session.attendance.filter(attendance => attendance.paymentStatus === 'UNPAID').length
        };
        this.deletingAttendanceId = null;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to delete attendance right now.';
        this.deletingAttendanceId = null;
        this.changeDetector.detectChanges();
      }
    });
  }

  private buildSessionLocationMap(
    attendances: AttendanceListItem[],
    bucketMinutes: number
  ): Map<string, { id: string; name: string }> {
    const locationBySession = new Map<string, { id: string; name: string }>();

    for (const attendance of attendances) {
      if (!attendance.location) {
        continue;
      }

      const trainedAt = new Date(attendance.trainedAt);
      const key = this.computeSessionKey(trainedAt, bucketMinutes);

      if (!locationBySession.has(key)) {
        locationBySession.set(key, attendance.location);
      }
    }

    return locationBySession;
  }

  private computeSessionKey(dateTime: Date, bucketMinutes: number): string {
    const minutesFromMidnight = dateTime.getHours() * 60 + dateTime.getMinutes();
    const bucketStartMin = Math.floor(minutesFromMidnight / bucketMinutes) * bucketMinutes;
    const startH = Math.floor(bucketStartMin / 60);
    const startM = bucketStartMin % 60;

    return `${this.selectedDate}|${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
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
