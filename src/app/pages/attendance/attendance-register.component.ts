import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AttendanceBatchPreview,
  AttendancePreviewRow,
  AttendanceService,
  CreateAttendanceBatchPayload,
} from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';
import {
  GymLocation,
  GymLocationsService,
} from '../../services/gym-locations.service';
import {
  TraineeProfile,
  TraineesService,
} from '../../services/trainees.service';
import {
  TrainerProfile,
  TrainersService,
} from '../../services/trainers.service';
import {
  TrainingTime,
  TrainingTimesService,
} from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChipComponent, ChipTone } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

/**
 * Register attendance in two steps: pick the session and who trained, then check a summary
 * before anything is saved. The summary comes from the API (`previewBatch`): per trainee, what
 * is left of their subscription after this training, with the ones near the end or unpaid first.
 */
@Component({
  selector: 'app-attendance-register',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    ReactiveFormsModule,
    AvatarComponent,
    ChipComponent,
    IconComponent,
    PageHeaderComponent,
    SkeletonListComponent,
  ],
  templateUrl: './attendance-register.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './attendance-register.component.scss',
})
export class AttendanceRegisterComponent implements OnInit {
  readonly form: FormGroup<{
    trainerId: FormControl<string>;
    locationId: FormControl<string>;
    trainedDate: FormControl<string>;
    trainedTime: FormControl<string>;
    traineeSearch: FormControl<string>;
  }>;

  loading = true;
  submitting = false;
  /** `select`: the session and who trained. `review`: the summary, before saving. */
  step: 'select' | 'review' = 'select';
  /** What the API said saving `payload` would do; set while reviewing. */
  preview: AttendanceBatchPreview | null = null;
  private payload: CreateAttendanceBatchPayload | null = null;

  @ViewChild('summaryTitle') private summaryTitle?: ElementRef<HTMLElement>;
  errorMessage: UiMessage | null = null;

  trainers: TrainerProfile[] = [];
  gymLocations: GymLocation[] = [];
  trainingTimes: TrainingTime[] = [];
  trainees: TraineeProfile[] = [];
  filteredTrainees: TraineeProfile[] = [];
  selectedTraineeIds = new Set<string>();

  readonly formatTimeWithoutSeconds = formatTimeWithoutSeconds;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly gymsService: GymLocationsService,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly traineesService: TraineesService,
    private readonly attendanceService: AttendanceService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly i18n: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.form = this.formBuilder.group({
      trainerId: this.formBuilder.nonNullable.control('', [
        Validators.required,
      ]),
      locationId: this.formBuilder.nonNullable.control('', [
        Validators.required,
      ]),
      trainedDate: this.formBuilder.nonNullable.control(this.todayIsoDate(), [
        Validators.required,
      ]),
      trainedTime: this.formBuilder.nonNullable.control(''),
      traineeSearch: this.formBuilder.nonNullable.control(''),
    });
  }

  ngOnInit(): void {
    forkJoin({
      trainers: this.trainersService.list(true),
      gymLocations: this.gymsService.list(false),
      trainingTimes: this.trainingTimesService.list(),
      trainees: this.traineesService.list(true),
    }).subscribe({
      next: ({ trainers, gymLocations, trainingTimes, trainees }) => {
        this.trainers = trainers.filter((item) => item.isActive);
        this.gymLocations = gymLocations.filter((item) => item.isActive);
        this.trainingTimes = [...trainingTimes].sort(
          (first, second) =>
            this.toMinutes(first.startTime) - this.toMinutes(second.startTime),
        );
        this.trainees = trainees.filter((item) => item.isActive);
        this.filteredTrainees = [...this.trainees];
        this.preselectCurrentTrainer();
        this.preselectDefaultLocation();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'attendance.register.loadError',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });

    this.form.controls.traineeSearch.valueChanges.subscribe((value) => {
      this.applyTraineeFilter(value);
      this.changeDetector.detectChanges();
    });
  }

  handleSubmit(): void {
    if (this.step === 'review') {
      this.save();
    } else {
      this.review();
    }
  }

  /** Back to the selection, which is kept as it was. */
  backToSelection(): void {
    this.step = 'select';
    this.preview = null;
    this.payload = null;
    this.errorMessage = null;
    this.changeDetector.detectChanges();
  }

  /** Trainees in the summary who are unpaid or near the end of their subscription. */
  get attentionCount(): number {
    return (
      this.preview?.trainees.filter((row) => row.level !== 'OK').length ?? 0
    );
  }

  get sessionTrainer(): string {
    const trainer = this.trainers.find(
      (item) => item.id === this.payload?.trainerId,
    );
    return trainer ? this.personName(trainer.name, trainer.nickname) : '—';
  }

  get sessionGym(): string {
    return (
      this.gymLocations.find((item) => item.id === this.payload?.locationId)
        ?.name ?? '—'
    );
  }

  get sessionDate(): string {
    return this.format.date(this.payload?.trainedDate);
  }

  get sessionTime(): string {
    return (
      this.payload?.trainedTime ??
      this.i18n.t('attendance.register.notSpecified')
    );
  }

  personName(name: string, nickname?: string | null): string {
    return nickname ? `${name} (${nickname})` : name;
  }

  /** Second line of a summary row: the plan that pays, and when a period ends. */
  summaryNote(row: AttendancePreviewRow): string {
    const subscription = row.subscription;
    if (!subscription) {
      return this.i18n.t('attendance.register.summary.noSubscription');
    }
    if (subscription.type === 'TIME') {
      return `${subscription.planTitle} · ${this.i18n.t(
        'attendance.register.summary.endsOn',
        { date: this.format.date(subscription.endsAt) },
      )}`;
    }
    return subscription.planTitle;
  }

  /** The key figure of a summary row: what is left after this training. */
  summaryChip(row: AttendancePreviewRow): string {
    const subscription = row.subscription;
    if (!subscription) {
      return this.i18n.t('attendance.register.summary.unpaid');
    }
    if (subscription.type === 'TIME') {
      return this.i18n.t('attendance.register.summary.daysLeft', {
        count: subscription.daysLeft ?? 0,
      });
    }
    const left = subscription.remainingCreditsAfter ?? 0;
    return left <= 0
      ? this.i18n.t('attendance.register.summary.lastTraining')
      : this.i18n.t('attendance.register.summary.creditsLeft', {
          count: left,
        });
  }

  summaryTone(row: AttendancePreviewRow): ChipTone {
    if (row.level === 'UNPAID') {
      return 'danger';
    }
    return row.level === 'OK' ? 'neutral' : 'warning';
  }

  /** Step 1 -> 2: asks the API what saving this selection would do. */
  private review(): void {
    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.changeDetector.detectChanges();
      return;
    }

    if (this.selectedTraineeIds.size === 0) {
      this.errorMessage = i18nMessage('attendance.register.selectAtLeastOne');
      this.changeDetector.detectChanges();
      return;
    }

    const raw = this.form.getRawValue();
    const trainedTime = formatTimeWithoutSeconds(raw.trainedTime.trim());
    const payload: CreateAttendanceBatchPayload = {
      trainerId: raw.trainerId,
      locationId: raw.locationId,
      traineeIds: Array.from(this.selectedTraineeIds),
      trainedDate: raw.trainedDate,
      ...(trainedTime ? { trainedTime } : {}),
    };

    this.submitting = true;

    this.attendanceService.previewBatch(payload).subscribe({
      next: (preview) => {
        this.payload = payload;
        this.preview = preview;
        this.step = 'review';
        this.submitting = false;
        this.changeDetector.detectChanges();
        // The page content changed in place: start reading from the summary.
        this.summaryTitle?.nativeElement.focus();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'attendance.register.previewError',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Step 2: saves exactly what was reviewed. */
  private save(): void {
    if (!this.payload) {
      return;
    }

    this.errorMessage = null;
    this.submitting = true;

    this.attendanceService.createBatch(this.payload).subscribe({
      next: () => {
        this.submitting = false;
        this.changeDetector.detectChanges();
        this.router.navigate(['/attendance']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'attendance.register.error');
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  isSelected(traineeId: string): boolean {
    return this.selectedTraineeIds.has(traineeId);
  }

  toggleTraineeSelection(traineeId: string, checked: boolean): void {
    if (checked) {
      this.selectedTraineeIds.add(traineeId);
    } else {
      this.selectedTraineeIds.delete(traineeId);
    }

    this.changeDetector.detectChanges();
  }

  selectFiltered(): void {
    this.filteredTrainees.forEach((trainee) =>
      this.selectedTraineeIds.add(trainee.id),
    );
    this.changeDetector.detectChanges();
  }

  clearFiltered(): void {
    this.filteredTrainees.forEach((trainee) =>
      this.selectedTraineeIds.delete(trainee.id),
    );
    this.changeDetector.detectChanges();
  }

  formatTrainingTimeOption(trainingTime: TrainingTime): string {
    return `${formatTimeWithoutSeconds(trainingTime.startTime)} - ${formatTimeWithoutSeconds(trainingTime.endTime)}`;
  }

  /**
   * The selected trainer's primary gym, else the first gym. Until the user picks a gym, it follows
   * the trainer: choosing another trainer moves to their primary gym.
   */
  private preselectDefaultLocation(): void {
    const location = this.form.controls.locationId;
    location.setValue(this.defaultLocationId());
    this.form.controls.trainerId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (location.pristine) {
          location.setValue(this.defaultLocationId());
        }
      });
  }

  private defaultLocationId(): string {
    const trainerId = this.form.controls.trainerId.value;
    const primary = this.trainers.find((t) => t.id === trainerId)?.primaryGymId;
    if (primary && this.gymLocations.some((g) => g.id === primary)) {
      return primary;
    }
    return this.gymLocations[0]?.id ?? '';
  }

  private preselectCurrentTrainer(): void {
    const currentTrainerId = this.authService.getTrainerProfileId();

    if (
      currentTrainerId &&
      this.trainers.some((item) => item.id === currentTrainerId)
    ) {
      this.form.controls.trainerId.setValue(currentTrainerId);
      return;
    }

    const firstTrainer = this.trainers[0];
    if (firstTrainer) {
      this.form.controls.trainerId.setValue(firstTrainer.id);
    }
  }

  private applyTraineeFilter(searchValue: string): void {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      this.filteredTrainees = [...this.trainees];
      return;
    }

    this.filteredTrainees = this.trainees.filter((trainee) => {
      const nameMatch = trainee.name.toLowerCase().includes(normalizedSearch);
      const nicknameMatch = (trainee.nickname || '')
        .toLowerCase()
        .includes(normalizedSearch);
      return nameMatch || nicknameMatch;
    });
  }

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
