import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import {
  AttendanceService,
  AttendanceSession,
  AttendanceSessionAttendanceItem,
  AttendanceSessionsQuery,
  AttendanceSessionsResponse
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { LanguageService } from '../../i18n/language.service';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';

@Component({
  selector: 'app-attendance-sessions',
  standalone: true,
  imports: [
    EnumLabelPipe, 
    UiMessagePipe, 
    TranslocoPipe, 
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ChipComponent,
    IconComponent,
    AvatarComponent
  ],
  templateUrl: './attendance-sessions.component.html',
  styleUrl: './attendance-sessions.component.scss'
})
export class AttendanceSessionsComponent implements OnInit {
  private readonly i18n = inject(LanguageService);
  readonly format = inject(LocaleFormatService);
  sessions: AttendanceSession[] = [];
  trainers: TrainerProfile[] = [];

  traineeNameById = new Map<string, string>();
  traineeNicknameById = new Map<string, string | null>();
  trainerNameById = new Map<string, string>();
  trainerNicknameById = new Map<string, string | null>();
  locationNameById = new Map<string, string>();

  selectedStartDate = this.isoDateDaysAgo(7);
  selectedEndDate = this.todayIsoDate();
  selectedStartTime = '';
  selectedEndTime = '';
  selectedTrainerId = '';

  selectedSessionKeys: string[] = [];

  loading = true;
  loadingTrainers = true;
  errorMessage: UiMessage | null = null;
  deletingAttendanceId: string | null = null;
  readonly canDeleteAttendance: boolean;
  readonly isAdmin: boolean;
  private readonly currentTrainerId: string | null;

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly trainersService: TrainersService,
    private readonly authService: AuthService,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    const userRole = this.authService.getUserRole();
    this.isAdmin = userRole === 'ADMIN';
    this.canDeleteAttendance = this.isAdmin || userRole === 'TRAINER';
    this.currentTrainerId = this.authService.getTrainerProfileId();

    if (!this.isAdmin && this.currentTrainerId) {
      this.selectedTrainerId = this.currentTrainerId;
    }
  }

  ngOnInit(): void {
    if (this.isAdmin) {
      this.loadTrainers();
    } else {
      this.loadingTrainers = false;
    }

    this.loadSessions();
  }

  get selectedSessions(): AttendanceSession[] {
    if (!this.sessions.length) {
      return [];
    }

    return this.sessions.filter(session => this.selectedSessionKeys.includes(session.sessionKey));
  }

  get selectedSessionsSummary(): {
    sessions: number;
    attendance: number;
    paid: number;
    unpaid: number;
    finalPriceCents: number;
  } {
    return this.selectedSessions.reduce(
      (summary, session) => {
        summary.sessions += 1;
        summary.attendance += session.totals.count;
        summary.paid += session.totals.paid;
        summary.unpaid += session.totals.unpaid;
        summary.finalPriceCents += session.attendance.reduce((sum, item) => {
          if (!item.price?.isFinal) {
            return sum;
          }

          return sum + item.price.priceCents;
        }, 0);

        return summary;
      },
      {
        sessions: 0,
        attendance: 0,
        paid: 0,
        unpaid: 0,
        finalPriceCents: 0
      }
    );
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = null;

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

    const trainerId = this.isAdmin ? this.selectedTrainerId : this.currentTrainerId;
    if (trainerId) {
      query.trainerId = trainerId;
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
        this.errorMessage = apiErrorMessage(error, 'attendance.sessions.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  trackBySession(_: number, session: AttendanceSession): string {
    return session.sessionKey;
  }

  toggleSession(sessionKey: string): void {
    const isSelected = this.selectedSessionKeys.includes(sessionKey);
    if (isSelected) {
      this.selectedSessionKeys = this.selectedSessionKeys.filter(key => key !== sessionKey);
      return;
    }

    this.selectedSessionKeys = [...this.selectedSessionKeys, sessionKey];
  }

  isSessionSelected(sessionKey: string): boolean {
    return this.selectedSessionKeys.includes(sessionKey);
  }
  formatPrice(priceCents: number): string {
    return this.format.money(priceCents);
  }

  attendancePrice(item: AttendanceSessionAttendanceItem): string {
    if (!item.price?.isFinal) {
      return '—';
    }

    return this.formatPrice(item.price.priceCents);
  }

  sessionTotalPrice(session: AttendanceSession): string {
    const totalCents = session.attendance.reduce((sum, item) => {
      if (!item.price?.isFinal) {
        return sum;
      }

      return sum + item.price.priceCents;
    }, 0);

    return this.formatPrice(totalCents);
  }

  sessionTabTitle(session: AttendanceSession): string {
    return `${this.format.shortDate(session.start)} · ${this.format.clock(session.start)}–${this.format.clock(session.end)}, ${this.formatTrainerNickname(session.trainerId)}`;
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

  canDeleteSessionAttendance(session: AttendanceSession): boolean {
    if (this.isAdmin) {
      return true;
    }

    return Boolean(this.currentTrainerId && this.currentTrainerId === session.trainerId);
  }

  deleteAttendance(session: AttendanceSession, item: AttendanceSessionAttendanceItem): void {
    if (!this.canDeleteSessionAttendance(session) || this.deletingAttendanceId) {
      return;
    }

    const confirmed = window.confirm(
      this.i18n.t('attendance.sessions.confirmDelete', {
        name: this.traineeName(item.traineeId),
        date: this.format.date(item.trainedAt),
        time: this.format.clock(item.trainedAt)
      })
    );

    if (!confirmed) {
      return;
    }

    this.errorMessage = null;
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
        this.errorMessage = apiErrorMessage(error, 'attendance.sessions.deleteError');
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
      this.selectedSessionKeys = [];
      return;
    }

    const availableSessionKeys = new Set(this.sessions.map(session => session.sessionKey));
    this.selectedSessionKeys = this.selectedSessionKeys.filter(key => availableSessionKeys.has(key));

    if (!this.selectedSessionKeys.length) {
      this.selectedSessionKeys = this.sessions.map(session => session.sessionKey);
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
    return this.isoDateDaysAgo(0);
  }

  private isoDateDaysAgo(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
