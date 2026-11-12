import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent } from '../../components/chip/chip.component';
import { IconComponent } from '../../components/icon/icon.component';
import { UiMessage } from '../../i18n/ui-message';
import {
  ScheduleTrainer,
  ScheduleTrainingTime,
} from '../../services/schedules.service';
import { TrainerProfile } from '../../services/trainers.service';
import { TrainingTime } from '../../services/training-times.service';
import { Workout } from '../../services/workouts.service';
import { SlotFormResult } from './schedule-slot-form';
import {
  ScheduleSlotFormComponent,
  timeRange,
} from './schedule-slot-form.component';

/** A training as the day list shows it: a template slot or a week slot. */
export interface ScheduleSlotView {
  id: string;
  trainingTime: ScheduleTrainingTime;
  trainer: ScheduleTrainer;
  workout?: { id: string; title: string | null } | null;
}

/** One day of the list: a weekday of a template, or a date of a real week. */
export interface ScheduleDayView {
  /** The date (YYYY-MM-DD) in a week, the ISO weekday ('1'...'7') in a template. */
  key: string;
  title: string;
  isToday: boolean;
  /** Read-only days (today and earlier in a week) show their trainings without actions. */
  editable: boolean;
  slots: ScheduleSlotView[];
}

/** Which form is open: a new training on a day (`slotId` null) or a training being changed. */
export interface SlotEditing {
  dayKey: string;
  slotId: string | null;
}

export interface SlotSave extends SlotEditing {
  result: SlotFormResult;
}

/**
 * The days of a schedule, Monday to Sunday, each with its trainings in order and, on the days
 * that can change, Edit, Remove and "Add a training" (an inline form). Presentational: the page
 * keeps the data, which form is open, and saves.
 */
@Component({
  selector: 'app-schedule-days',
  standalone: true,
  imports: [
    TranslocoPipe,
    ChipComponent,
    IconComponent,
    ScheduleSlotFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './schedule-days.component.html',
  styleUrl: './schedule-days.component.scss',
})
export class ScheduleDaysComponent {
  @Input({ required: true }) days: ScheduleDayView[] = [];
  @Input() editing: SlotEditing | null = null;
  @Input() trainingTimes: TrainingTime[] = [];
  @Input() trainers: TrainerProfile[] = [];
  /** The week's workouts in a real week (the form offers the day's); null in a template. */
  @Input() workouts: Workout[] | null = null;
  @Input() saving = false;
  @Input() formError: UiMessage | null = null;
  /** The training being removed, whose Remove button waits. */
  @Input() removingId: string | null = null;
  /** Names the day list, e.g. "Days of the week". */
  @Input({ required: true }) label = '';

  @Output() readonly add = new EventEmitter<string>();
  @Output() readonly edit = new EventEmitter<SlotEditing>();
  @Output() readonly cancelEdit = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<SlotSave>();
  @Output() readonly remove = new EventEmitter<ScheduleSlotView>();

  readonly range = timeRange;

  isEditing(dayKey: string, slotId: string | null): boolean {
    return (
      !!this.editing &&
      this.editing.dayKey === dayKey &&
      this.editing.slotId === slotId
    );
  }

  workoutsOf(dayKey: string): Workout[] | null {
    return this.workouts
      ? this.workouts.filter((w) => w.date === dayKey)
      : null;
  }

  describe(day: ScheduleDayView, slot: ScheduleSlotView): string {
    return `${day.title} ${this.range(slot.trainingTime)} ${slot.trainer.name}`;
  }
}
