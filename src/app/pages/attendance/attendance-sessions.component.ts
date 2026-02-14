import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AttendanceService,
  AttendanceSession,
  AttendanceSessionAttendanceItem,
  AttendanceSessionsQuery,
  AttendanceSessionsResponse
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

  traineeNameById = new Map<string, string>();
  traineeNicknameById = new Map<string, string | null>();
  trainerNameById = new Map<string, string>();
  trainerNicknameById = new Map<string, string | null>();
  locationNameById = new Map<string, string>();

  selectedStartDate = this.todayIsoDate();
  selectedEndDate = this.todayIsoDate();
  selectedStartTime = '';
  selectedEndTime = '';
  selectedTrainerId = '';
  selectedBucketMinutes: number | null = null;

  selectedSessionKey = '';

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

  get activeSession(): AttendanceSession | null {
    if (!this.sessions.length) {
      return null;
    }

    return this.sessions.find(session => session.sessionKey === this.selectedSessionKey) ?? this.sessions[0];
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';

    const query: AttendanceSessionsQuery = {
      startDate: this.selectedStartDate,
      endDate: this.selectedEndDate
    };

    if (this.selectedStartTime) {
      query.startTime = this.selectedStartTime;
    }

    if (this.selectedEndTime) {
      query.endTime = this.selectedEndTime;
    }

    if (this.selectedTrainerId) {
      query.trainerId = this.selectedTrainerId;
    }

    if (this.selectedBucketMinutes) {
      query.bucketMinutes = this.selectedBucketMinutes;
    }

    this.attendanceService.sessions(query).subscribe({
      next: (response) => {
        this.applyEntities(response);
        this.sessions = response.sessions;
        this.ensureSelectedSession();
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

  selectSession(sessionKey: string): void {
    this.selectedSessionKey = sessionKey;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  sessionTabTitle(session: AttendanceSession): string {
    return `${this.formatDateTime(session.start)} - ${this.formatDateTime(session.end)}, ${this.formatTrainerNickname(session.trainerId)}`;
  }

  formatTrainer(session: AttendanceSession): string {
    return this.formatTrainerLabel(session.trainerId);
  }

  formatTrainerNickname(trainerId: string): string {
    const nickname = this.trainerNicknameById.get(trainerId);
    if (nickname) {
      return nickname;
    }

    return this.trainerNameById.get(trainerId) || '—';
  }

  traineeName(traineeId: string): string {
    return this.traineeNameById.get(traineeId) || '—';
  }

  traineeNickname(traineeId: string): string {
    return this.traineeNicknameById.get(traineeId) || '—';
  }

  locationName(locationId: string): string {
    return this.locationNameById.get(locationId) || '—';
  }

  deleteAttendance(session: AttendanceSession, item: AttendanceSessionAttendanceItem): void {
    if (!this.canDeleteAttendance || this.deletingAttendanceId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete attendance for ${this.traineeName(item.traineeId)} at ${this.formatDateTime(item.trainedAt)}?`
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

  private applyEntities(response: AttendanceSessionsResponse): void {
    this.traineeNameById = new Map(response.entities.trainees.map(item => [item.id, item.name]));
    this.traineeNicknameById = new Map(
      response.entities.trainees.map(item => [item.id, item.nickname ?? null])
    );
    this.trainerNameById = new Map(response.entities.trainers.map(item => [item.id, item.name]));
    this.trainerNicknameById = new Map(
      response.entities.trainers.map(item => [item.id, item.nickname ?? null])
    );
    this.locationNameById = new Map(response.entities.locations.map(item => [item.id, item.name]));
  }

  private ensureSelectedSession(): void {
    if (!this.sessions.length) {
      this.selectedSessionKey = '';
      return;
    }

    const hasSelectedSession = this.sessions.some(session => session.sessionKey === this.selectedSessionKey);
    if (!hasSelectedSession) {
      this.selectedSessionKey = this.sessions[0].sessionKey;
    }
  }

  private formatTrainerLabel(trainerId: string): string {
    const trainerName = this.trainerNameById.get(trainerId);
    const trainerNickname = this.trainerNicknameById.get(trainerId);

    if (!trainerName) {
      return '—';
    }

    return trainerNickname ? `${trainerName} (${trainerNickname})` : trainerName;
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
