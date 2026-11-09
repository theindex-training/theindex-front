import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../components/icon/icon.component';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import {
  Exercise,
  EXERCISE_MEASURES,
  EXERCISE_MODALITIES,
  ExerciseMeasure,
  ExerciseModality,
} from '../../services/exercises.service';
import { WorkoutType } from '../../services/workout-types.service';
import {
  buildItem,
  hasMore,
  ItemForm,
  itemProblem,
  MAX_ITEMS,
  parseRepScheme,
  StructureField,
  structureFields,
  VariantForm,
} from './workout-form';

/** Static keys, so the i18n key test sees them. */
const ITEM_ERRORS: Record<string, string> = {
  exercise: 'workouts.form.itemErrors.exercise',
  unknownExercise: 'workouts.form.itemErrors.unknownExercise',
  whole: 'workouts.form.itemErrors.whole',
  time: 'workouts.form.itemErrors.time',
  amountRequired: 'workouts.form.itemErrors.amountRequired',
  repsRequired: 'workouts.form.itemErrors.repsRequired',
  rangeNeedsAmount: 'workouts.form.itemErrors.rangeNeedsAmount',
  range: 'workouts.form.itemErrors.range',
  femaleNeedsAmount: 'workouts.form.itemErrors.femaleNeedsAmount',
  femaleNeedsLoad: 'workouts.form.itemErrors.femaleNeedsLoad',
  field: 'workouts.form.itemErrors.field',
};

const AMOUNT_LABELS: Record<ExerciseMeasure, string> = {
  REPS: 'workouts.form.amount.REPS',
  DISTANCE: 'workouts.form.amount.DISTANCE',
  TIME: 'workouts.form.amount.TIME',
  CALORIES: 'workouts.form.amount.CALORIES',
};

const STRUCTURE_LABELS: Record<StructureField, string> = {
  rounds: 'workouts.form.structure.rounds',
  repScheme: 'workouts.form.structure.repScheme',
  duration: 'workouts.form.structure.duration',
  timeCap: 'workouts.form.structure.timeCap',
  interval: 'workouts.form.structure.interval',
  work: 'workouts.form.structure.work',
  rest: 'workouts.form.structure.rest',
};

const STRUCTURE_HINTS: Record<StructureField, string> = {
  rounds: 'workouts.form.structure.roundsHint',
  repScheme: 'workouts.form.structure.repSchemeHint',
  duration: 'workouts.form.structure.timeHint',
  timeCap: 'workouts.form.structure.timeHint',
  interval: 'workouts.form.structure.intervalHint',
  work: 'workouts.form.structure.timeHint',
  rest: 'workouts.form.structure.timeHint',
};

/**
 * One level of a workout part: how it is organised (rounds, rep scheme, times) and its
 * exercises. The page owns the form; this renders a level and adds, removes and moves its items.
 */
@Component({
  selector: 'app-workout-variant',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe, EnumLabelPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workout-variant.component.html',
  styleUrl: './workout-variant.component.scss',
})
export class WorkoutVariantComponent implements OnChanges {
  @Input({ required: true }) variant!: VariantForm;
  @Input() type: WorkoutType | undefined;
  @Input({ required: true }) exercises: Exercise[] = [];
  /** Unique within the page, for the fields' ids. */
  @Input({ required: true }) idPrefix = '';
  /** Show the problems of untouched fields too (after a submit attempt). */
  @Input() showErrors = false;

  readonly measures = EXERCISE_MEASURES;
  readonly maxItems = MAX_ITEMS;
  readonly structureLabels = STRUCTURE_LABELS;
  readonly structureHints = STRUCTURE_HINTS;
  readonly amountLabels = AMOUNT_LABELS;

  groups: { modality: ExerciseModality; exercises: Exercise[] }[] = [];
  /** Items whose extra fields were opened by hand. */
  private readonly opened = new Set<ItemForm>();

  constructor(private readonly formBuilder: FormBuilder) {}

  ngOnChanges(): void {
    this.groups = EXERCISE_MODALITIES.map((modality) => ({
      modality,
      exercises: this.exercises.filter((e) => e.modality === modality),
    })).filter((group) => group.exercises.length);
  }

  get items(): ItemForm[] {
    return this.variant.controls.items.controls;
  }

  get fields(): StructureField[] {
    return structureFields(this.type, this.variant);
  }

  /** Inactive exercises are offered only to the item that already uses them. */
  offered(exercise: Exercise, item: ItemForm): boolean {
    return exercise.isActive || item.controls.exerciseId.value === exercise.id;
  }

  structureInvalid(field: StructureField): boolean {
    const control = this.variant.controls[field];
    return (control.touched || this.showErrors) && control.invalid;
  }

  /** The translation key of the item's problem, when it is time to show it. */
  itemError(item: ItemForm): string | null {
    if (!this.showErrors && !item.touched) {
      return null;
    }
    const scheme = parseRepScheme(this.variant.controls.repScheme.value);
    const problem = itemProblem(item.getRawValue(), scheme !== null);
    if (problem) {
      return ITEM_ERRORS[problem];
    }
    return item.invalid ? ITEM_ERRORS['field'] : null;
  }

  isOpen(item: ItemForm): boolean {
    return this.opened.has(item) || hasMore(item);
  }

  /** Extra fields that hold a value stay open, so nothing typed is hidden. */
  canClose(item: ItemForm): boolean {
    return this.opened.has(item) && !hasMore(item);
  }

  toggleMore(item: ItemForm): void {
    if (this.opened.has(item)) {
      this.opened.delete(item);
    } else {
      this.opened.add(item);
    }
  }

  /** Picking an exercise sets what it is usually counted in, while no amount is typed yet. */
  exerciseChosen(item: ItemForm): void {
    const exercise = this.exercises.find(
      (e) => e.id === item.controls.exerciseId.value,
    );
    item.controls.pendingName.setValue('');
    if (exercise && !item.controls.quantity.value.trim()) {
      item.controls.measure.setValue(exercise.defaultMeasure);
    }
  }

  addItem(): void {
    if (this.items.length < MAX_ITEMS) {
      this.variant.controls.items.push(buildItem(this.formBuilder));
    }
  }

  removeItem(index: number): void {
    this.opened.delete(this.items[index]);
    this.variant.controls.items.removeAt(index);
  }

  moveItem(index: number, delta: -1 | 1): void {
    const array = this.variant.controls.items;
    const target = index + delta;
    if (target < 0 || target >= array.length) {
      return;
    }
    const item = array.at(index);
    array.removeAt(index);
    array.insert(target, item);
  }
}
