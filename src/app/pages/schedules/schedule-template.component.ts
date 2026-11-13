import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin, of } from 'rxjs';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import {
  ScheduleTemplate,
  SchedulesService,
  TemplateSlot,
} from '../../services/schedules.service';
import {
  TrainerProfile,
  TrainersService,
} from '../../services/trainers.service';
import {
  TrainingTime,
  TrainingTimesService,
} from '../../services/training-times.service';
import {
  ScheduleDayView,
  ScheduleDaysComponent,
  ScheduleSlotView,
  SlotEditing,
  SlotSave,
} from './schedule-days.component';
import { changedSlotFields } from './schedule-slot-form';
import { timeRange } from './schedule-slot-form.component';

/**
 * A gym's usual week (ADMIN): its trainings, Monday to Sunday. Trainers and admins create real
 * weeks from it on the Schedule page; changing it later changes no week that exists.
 */
@Component({
  selector: 'app-schedule-template',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ScheduleDaysComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './schedule-template.component.html',
})
export class ScheduleTemplateComponent implements OnInit {
  gymId = '';
  template: ScheduleTemplate | null = null;
  trainingTimes: TrainingTime[] = [];
  trainers: TrainerProfile[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  editing: SlotEditing | null = null;
  saving = false;
  formError: UiMessage | null = null;
  removingId: string | null = null;
  /** A failed removal, shown above the days. */
  actionError: UiMessage | null = null;

  constructor(
    private readonly schedules: SchedulesService,
    private readonly trainingTimesService: TrainingTimesService,
    private readonly trainersService: TrainersService,
    private readonly language: LanguageService,
    private readonly format: LocaleFormatService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.gymId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.gymId) {
      this.errorMessage = i18nMessage('common.missingId');
      this.loading = false;
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;
    forkJoin({
      template: this.schedules.template(this.gymId),
      trainingTimes: this.trainingTimesService.list(),
      trainers: this.trainersService.list(true),
    }).subscribe({
      next: ({ template, trainingTimes, trainers }) => {
        this.template = template;
        this.trainingTimes = trainingTimes;
        this.trainers = trainers;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'schedules.template.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  get days(): ScheduleDayView[] {
    const slots = this.template?.slots ?? [];
    return [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      key: String(weekday),
      title: this.format.weekday(weekday),
      isToday: false,
      editable: true,
      slots: slots.filter((s) => s.weekday === weekday),
    }));
  }

  get slotCount(): number {
    return this.template?.slots.length ?? 0;
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
    const slot = slotId
      ? this.template?.slots.find((s) => s.id === slotId)
      : undefined;
    const request = slot
      ? this.schedules.updateTemplateSlot(
          slot.id,
          changedSlotFields(slot, result, false),
        )
      : this.schedules.addTemplateSlot(this.gymId, {
          ...result.trainingTime,
          weekday: Number(dayKey),
          trainerId: result.trainerId,
        });
    this.saving = true;
    this.formError = null;
    request.subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        this.reload('trainingTime' in result.trainingTime);
      },
      error: (error) => {
        this.saving = false;
        this.formError = apiErrorMessage(error, 'schedules.slot.saveError');
        this.changeDetector.detectChanges();
      },
    });
  }

  removeSlot(view: ScheduleSlotView): void {
    const slot = this.template?.slots.find((s) => s.id === view.id);
    if (!slot || !window.confirm(this.confirmText(slot))) {
      return;
    }
    this.removingId = slot.id;
    this.actionError = null;
    this.editing = null;
    this.schedules.deleteTemplateSlot(slot.id).subscribe({
      next: () => {
        this.removingId = null;
        this.reload(false);
      },
      error: (error) => {
        this.removingId = null;
        this.actionError = apiErrorMessage(error, 'schedules.slot.removeError');
        this.changeDetector.detectChanges();
      },
    });
  }

  private confirmText(slot: TemplateSlot): string {
    return this.language.t('schedules.template.confirmRemove', {
      day: this.format.weekday(slot.weekday),
      time: timeRange(slot.trainingTime),
      trainer: slot.trainer.name,
    });
  }

  /** Shows the template as saved; with a new training time, the training times too. */
  private reload(withTrainingTimes: boolean): void {
    forkJoin({
      template: this.schedules.template(this.gymId),
      trainingTimes: withTrainingTimes
        ? this.trainingTimesService.list()
        : of(this.trainingTimes),
    }).subscribe({
      next: ({ template, trainingTimes }) => {
        this.template = template;
        this.trainingTimes = trainingTimes;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.actionError = apiErrorMessage(
          error,
          'schedules.template.loadErrorMessage',
        );
        this.changeDetector.detectChanges();
      },
    });
  }
}
