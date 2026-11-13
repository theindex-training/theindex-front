import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import { UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { ScheduleTrainer } from '../../services/schedules.service';
import { TrainerProfile } from '../../services/trainers.service';
import { TrainingTime } from '../../services/training-times.service';
import { Workout } from '../../services/workouts.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import {
  EditableSlot,
  NEW_TRAINING_TIME,
  SlotFormResult,
  createSlotForm,
  fillSlotForm,
  matchingTrainingTime,
  slotFormResult,
  sortTrainingTimes,
} from './schedule-slot-form';

let nextId = 0;

/** "07:10 – 08:10" from Postgres times. */
export function timeRange(time: {
  startTime: string;
  endTime: string;
}): string {
  return `${formatTimeWithoutSeconds(time.startTime)} – ${formatTimeWithoutSeconds(time.endTime)}`;
}

/**
 * The inline form that adds or changes one training of a schedule: its training time (or a new
 * one, created when saved), its trainer and, in a real week, the day's workout it follows.
 */
@Component({
  selector: 'app-schedule-slot-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe, UiMessagePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './schedule-slot-form.component.html',
  styles: `
    .slot-form {
      display: grid;
      gap: var(--space-4);
    }
  `,
})
export class ScheduleSlotFormComponent implements OnInit {
  /** The slot being changed; null adds one. */
  @Input() slot: (EditableSlot & { trainer: ScheduleTrainer }) | null = null;
  @Input({ required: true }) trainingTimes: TrainingTime[] = [];
  /** The active trainers. */
  @Input({ required: true }) trainers: TrainerProfile[] = [];
  /** The day's workouts in a real week; null in a template (no workout field). */
  @Input() workouts: Workout[] | null = null;
  /** Names the form for screen readers, e.g. "Add a training on Monday". */
  @Input({ required: true }) label = '';
  @Input() saving = false;
  @Input() error: UiMessage | null = null;
  @Output() readonly save = new EventEmitter<SlotFormResult>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly id = `slot-form-${nextId++}`;
  readonly form = createSlotForm();
  readonly newTime = NEW_TRAINING_TIME;
  readonly range = timeRange;

  constructor(private readonly language: LanguageService) {}

  ngOnInit(): void {
    fillSlotForm(this.form, this.slot);
  }

  get sortedTimes(): TrainingTime[] {
    return sortTrainingTimes(this.trainingTimes);
  }

  /** The active trainers, plus the slot's own when it has become inactive. */
  get trainerOptions(): { id: string; name: string; isActive: boolean }[] {
    const options = this.trainers.map((t) => ({
      id: t.id,
      name: t.name,
      isActive: true,
    }));
    const current = this.slot?.trainer;
    if (current && !options.some((o) => o.id === current.id)) {
      options.push({ id: current.id, name: current.name, isActive: false });
    }
    return options;
  }

  get isNewTime(): boolean {
    return this.form.controls.trainingTimeId.value === NEW_TRAINING_TIME;
  }

  /** Says what saving does with the hours typed: use the training time that has them, or add one. */
  newTimeNotice(): string | null {
    const { startTime, endTime } = this.form.getRawValue();
    if (this.form.errors || !startTime || !endTime) {
      return null;
    }
    const range = timeRange({ startTime, endTime });
    return matchingTrainingTime(this.trainingTimes, startTime, endTime)
      ? this.language.t('schedules.slot.existingTime', { range })
      : this.language.t('schedules.slot.newTimeNotice', { range });
  }

  workoutLabel(workout: Workout): string {
    if (workout.title) {
      return workout.title;
    }
    const firstLine = workout.summary.split('\n')[0] ?? '';
    return firstLine.length > 40
      ? `${firstLine.slice(0, 40)}…`
      : firstLine || this.language.t('workouts.list.untitled');
  }

  showError(name: 'trainingTimeId' | 'trainerId'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  showTimeError(name: 'startTime' | 'endTime' | 'endBeforeStart'): boolean {
    const touched =
      this.form.controls.startTime.touched ||
      this.form.controls.endTime.touched;
    return touched && !!this.form.errors?.[name];
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(slotFormResult(this.form, this.trainingTimes));
  }
}
