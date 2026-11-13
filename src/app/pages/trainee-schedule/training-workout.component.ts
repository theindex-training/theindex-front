import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { TrainingWorkout } from '../../services/bookings.service';
import { ExerciseVideoComponent } from './exercise-video.component';

/**
 * The workout section of a training's page, the same for trainees (`/schedule/:id`) and staff
 * (`/workouts/schedule/:id`): the summary with its line breaks, then the exercises in order with
 * their descriptions and videos. Without a workout, an empty state with the page's own words.
 */
@Component({
  selector: 'app-training-workout',
  standalone: true,
  imports: [TranslocoPipe, EmptyStateComponent, ExerciseVideoComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './training-workout.component.html',
  styleUrl: './training-workout.component.scss',
})
export class TrainingWorkoutComponent {
  @Input({ required: true }) workout: TrainingWorkout | null = null;
  /** Shown when the training has no workout (translated text). */
  @Input({ required: true }) emptyTitle = '';
  @Input({ required: true }) emptyMessage = '';
}
