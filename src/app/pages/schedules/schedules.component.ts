import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, Observable, of } from 'rxjs';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { IconComponent } from '../../components/icon/icon.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { AuthService } from '../../services/auth.service';
import {
  GymLocation,
  GymLocationsService,
} from '../../services/gym-locations.service';
import {
  ScheduleSlot,
  ScheduleTemplate,
  ScheduleWeek,
  SchedulesService,
} from '../../services/schedules.service';
import {
  TrainerProfile,
  TrainersService,
} from '../../services/trainers.service';
import {
  TrainingTime,
  TrainingTimesService,
} from '../../services/training-times.service';
import { Workout, WorkoutsService } from '../../services/workouts.service';
import { addDays, dayKeyToDate, localDayKey } from '../../utils/calendar.util';
import { WorkoutsNavComponent } from '../workouts/workouts-nav.component';
import { mondayOf } from '../workouts/workouts.component';
import {
  ScheduleDayView,
  ScheduleDaysComponent,
  ScheduleSlotView,
  SlotEditing,
  SlotSave,
} from './schedule-days.component';
import { initialGymId, rememberGym } from './schedule-gym';
import { changedSlotFields } from './schedule-slot-form';
import { timeRange } from './schedule-slot-form.component';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The gyms' real weeks (ADMIN and TRAINER): pick a gym and a week; a week not created yet is
 * created from the gym's template with one button, then its trainings can change from tomorrow
 * on. `?gym=` and `?week=` (any day of the week) keep the choice in the address.
 */
@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    WorkoutsNavComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    IconComponent,
    ScheduleDaysComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
})
export class SchedulesComponent implements OnInit {
  gyms: GymLocation[] = [];
  trainingTimes: TrainingTime[] = [];
  trainers: TrainerProfile[] = [];
  /** The catalogues (gyms, training times, trainers) loaded once. */
  ready = false;
  setupError: UiMessage | null = null;

  gymId = '';
  weekStart = '';
  schedule: ScheduleWeek | null = null;
  /** The gym's template, while the week isn't created yet. */
  template: ScheduleTemplate | null = null;
  workouts: Workout[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  creating = false;
  editing: SlotEditing | null = null;
  saving = false;
  formError: UiMessage | null = null;
  removingId: string | null = null;
  /** A failed create or removal, shown above the days. */
  actionError: UiMessage | null = null;

  readonly isAdmin: boolean;
  private readonly trainerProfileId: string | null;

  constructor(
    private readonly schedules: SchedulesService,
    private readonly gymsService: GymLocationsService,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly trainersService: TrainersService,
    private readonly workoutsService: WorkoutsService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
    auth: AuthService,
  ) {
    this.isAdmin = auth.getUserRole() === 'ADMIN';
    this.trainerProfileId = auth.getTrainerProfileId();
  }

  /** The signed-in trainer's primary gym, the page's default gym. */
  private get primaryGymId(): string | null {
    return (
      this.trainers.find((t) => t.id === this.trainerProfileId)?.primaryGymId ??
      null
    );
  }

  ngOnInit(): void {
    this.loadSetup();
  }

  /** Gyms, training times and trainers; then the week the address names. */
  loadSetup(): void {
    this.setupError = null;
    this.loading = true;
    forkJoin({
      gyms: this.gymsService.list(),
      trainingTimes: this.trainingTimesService.list(),
      trainers: this.trainersService.list(true),
    }).subscribe({
      next: ({ gyms, trainingTimes, trainers }) => {
        this.gyms = gyms.filter((g) => g.isActive);
        this.trainingTimes = trainingTimes;
        this.trainers = trainers;
        this.ready = true;
        this.followAddress();
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.setupError = apiErrorMessage(
          error,
          'schedules.week.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /**
   * The page is reused when only the query changes (the tab link, the back button), so the gym
   * and week follow the address, not just its first value.
   */
  private followAddress(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const gymId =
          initialGymId(
            this.gyms.map((g) => g.id),
            params.get('gym'),
            this.primaryGymId,
          ) ?? '';
        const week = params.get('week') ?? '';
        const start = mondayOf(DATE_PATTERN.test(week) ? week : this.today());
        if (gymId !== this.gymId || start !== this.weekStart) {
          this.gymId = gymId;
          this.weekStart = start;
          this.load();
          this.changeDetector.markForCheck();
        }
      });
  }

  private today(): string {
    return localDayKey(new Date())!;
  }

  get weekEnd(): string {
    return addDays(this.weekStart, 6);
  }

  get isThisWeek(): boolean {
    return this.weekStart === mondayOf(this.today());
  }

  get gymOptions(): SegmentedOption[] {
    return this.gyms.map((g) => ({ value: g.id, label: g.name }));
  }

  get gymName(): string {
    return this.gyms.find((g) => g.id === this.gymId)?.name ?? '';
  }

  load(): void {
    if (!this.gymId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    this.actionError = null;
    this.editing = null;
    const gymId = this.gymId;
    const start = this.weekStart;
    const current = () => gymId === this.gymId && start === this.weekStart;

    this.schedules.week(gymId, start).subscribe({
      next: (schedule) => {
        if (!current()) {
          return;
        }
        this.loadAround(schedule).subscribe({
          next: (extra) => {
            if (!current()) {
              return;
            }
            this.schedule = schedule;
            this.template = extra.template;
            this.workouts = extra.workouts;
            this.loading = false;
            this.changeDetector.detectChanges();
          },
          error: (error) => this.loadFailed(error, current),
        });
      },
      error: (error) => this.loadFailed(error, current),
    });
  }

  private loadFailed(error: unknown, current: () => boolean): void {
    if (!current()) {
      return;
    }
    this.errorMessage = apiErrorMessage(
      error,
      'schedules.week.loadErrorMessage',
    );
    this.loading = false;
    this.changeDetector.detectChanges();
  }

  /** A created week needs the week's workouts (for the form); one not created, the template. */
  private loadAround(schedule: ScheduleWeek): Observable<{
    template: ScheduleTemplate | null;
    workouts: Workout[];
  }> {
    return schedule.week
      ? forkJoin({
          template: of(null),
          workouts: this.workoutsService.list({
            from: schedule.weekStart,
            to: schedule.weekEnd,
          }),
        })
      : forkJoin({
          template: this.schedules.template(schedule.gym.id),
          workouts: of([] as Workout[]),
        });
  }

  /** Moves the address; the subscription to it loads what it names. */
  private navigate(gymId: string, start: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        gym: gymId,
        week: start === mondayOf(this.today()) ? null : start,
      },
      replaceUrl: true,
    });
  }

  selectGym(gymId: string): void {
    rememberGym(gymId);
    this.navigate(gymId, this.weekStart);
  }

  showWeek(day: string): void {
    this.navigate(this.gymId, mondayOf(day));
  }

  previousWeek(): void {
    this.showWeek(addDays(this.weekStart, -7));
  }

  nextWeek(): void {
    this.showWeek(addDays(this.weekStart, 7));
  }

  thisWeek(): void {
    this.showWeek(this.today());
  }

  weekLabel(): string {
    return this.language.t('workouts.list.week', {
      from: this.format.custom(dayKeyToDate(this.weekStart), 'd MMM'),
      to: this.format.custom(dayKeyToDate(this.weekEnd), 'd MMM y'),
    });
  }

  dayLabel(day: string): string {
    return this.format.custom(dayKeyToDate(day), 'EEEE, d MMMM');
  }

  /** The API's "today" (the day before the first editable one). */
  private gymToday(): string {
    return this.schedule
      ? addDays(this.schedule.editableFrom, -1)
      : this.today();
  }

  /** A week that is over can't be created any more. */
  get isOver(): boolean {
    return !!this.schedule && this.schedule.weekEnd < this.gymToday();
  }

  /** Some days of the shown week are read-only already. */
  get hasLockedDays(): boolean {
    return (
      !!this.schedule?.week &&
      this.schedule.weekStart < this.schedule.editableFrom
    );
  }

  get days(): ScheduleDayView[] {
    const schedule = this.schedule;
    if (!schedule) {
      return [];
    }
    const today = this.gymToday();
    return Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(schedule.weekStart, offset);
      return {
        key: date,
        title: this.dayLabel(date),
        isToday: date === today,
        editable: date >= schedule.editableFrom,
        slots: schedule.slots.filter((s) => s.date === date),
      };
    });
  }

  createWeek(): void {
    if (!this.schedule) {
      return;
    }
    this.creating = true;
    this.actionError = null;
    const { gym, weekStart } = this.schedule;
    this.schedules.createWeek(gym.id, weekStart).subscribe({
      next: () => {
        this.creating = false;
        // The answer is the new week; load it with its workouts, unless the page moved on.
        if (gym.id === this.gymId && weekStart === this.weekStart) {
          this.load();
        }
      },
      error: (error) => {
        this.creating = false;
        this.actionError = apiErrorMessage(error, 'schedules.week.createError');
        this.changeDetector.detectChanges();
      },
    });
  }

  startAdd(dayKey: string): void {
    this.openForm({ dayKey, slotId: null });
  }

  startEdit(editing: SlotEditing): void {
    this.openForm(editing);
  }

  closeForm(): void {
    this.editing = null;
    this.formError = null;
  }

  private openForm(editing: SlotEditing): void {
    this.editing = editing;
    this.formError = null;
    this.actionError = null;
  }

  saveSlot({ dayKey, slotId, result }: SlotSave): void {
    const week = this.schedule?.week;
    if (!week) {
      return;
    }
    const slot = slotId ? this.findSlot(slotId) : undefined;
    const request = slot
      ? this.schedules.updateSlot(
          slot.id,
          changedSlotFields(slot, result, true),
        )
      : this.schedules.addSlot(week.id, {
          ...result.trainingTime,
          date: dayKey,
          trainerId: result.trainerId,
          workoutId: result.workoutId,
        });
    this.saving = true;
    this.formError = null;
    request.subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        this.refresh('trainingTime' in result.trainingTime);
      },
      error: (error) => {
        this.saving = false;
        this.formError = apiErrorMessage(error, 'schedules.slot.saveError');
        this.changeDetector.detectChanges();
      },
    });
  }

  removeSlot(view: ScheduleSlotView): void {
    const slot = this.findSlot(view.id);
    if (!slot) {
      return;
    }
    // The API refuses it too; say so without asking first.
    if (slot.bookedCount > 0) {
      this.editing = null;
      this.actionError = i18nMessage('schedules.week.cannotRemoveBooked', {
        count: slot.bookedCount,
      });
      return;
    }
    if (!window.confirm(this.confirmText(slot))) {
      return;
    }
    this.removingId = slot.id;
    this.actionError = null;
    this.editing = null;
    this.schedules.deleteSlot(slot.id).subscribe({
      next: () => {
        this.removingId = null;
        this.refresh(false);
      },
      error: (error) => {
        this.removingId = null;
        this.actionError = apiErrorMessage(error, 'schedules.slot.removeError');
        this.changeDetector.detectChanges();
      },
    });
  }

  private findSlot(id: string): ScheduleSlot | undefined {
    return this.schedule?.slots.find((s) => s.id === id);
  }

  private confirmText(slot: ScheduleSlot): string {
    return this.language.t('schedules.week.confirmRemove', {
      day: this.dayLabel(slot.date),
      time: timeRange(slot.trainingTime),
      trainer: slot.trainer.name,
    });
  }

  /** Shows the week as saved, keeping the page; with a new training time, the times too. */
  private refresh(withTrainingTimes: boolean): void {
    const gymId = this.gymId;
    const start = this.weekStart;
    forkJoin({
      schedule: this.schedules.week(gymId, start),
      trainingTimes: withTrainingTimes
        ? this.trainingTimesService.list()
        : of(this.trainingTimes),
    }).subscribe({
      next: ({ schedule, trainingTimes }) => {
        if (gymId !== this.gymId || start !== this.weekStart) {
          return;
        }
        this.schedule = schedule;
        this.trainingTimes = trainingTimes;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.actionError = apiErrorMessage(
          error,
          'schedules.week.loadErrorMessage',
        );
        this.changeDetector.detectChanges();
      },
    });
  }

  get templateCount(): number {
    return this.template?.slots.length ?? 0;
  }

  /** Why a week can't be created yet, when it can't. */
  get notCreatedReason(): UiMessage | null {
    if (this.isOver) {
      return i18nMessage('schedules.week.overMessage');
    }
    if (!this.template?.slots.length) {
      return i18nMessage('schedules.week.noTemplateMessage');
    }
    return null;
  }
}
