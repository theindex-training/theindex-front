import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ExercisesTableComponent } from '../../components/exercises-table/exercises-table.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../components/search-field/search-field.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { Exercise, ExercisesService } from '../../services/exercises.service';

/**
 * The trainees' exercise library: the active exercises of the catalogue (the API gives trainees
 * no others), as the staff's Exercises page lists them, without the status. Loaded once; the
 * search works on it.
 */
@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    SearchFieldComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ExercisesTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './exercise-library.component.html',
})
export class ExerciseLibraryComponent implements OnInit {
  exercises: Exercise[] = [];
  filtered: Exercise[] = [];
  term = '';
  loading = true;
  errorMessage: UiMessage | null = null;

  readonly detailLink = (exercise: Exercise) => ['/exercises', exercise.id];

  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.exercisesService.list({ active: true }).subscribe({
      next: (exercises) => {
        this.exercises = exercises;
        this.applySearch();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'exerciseLibrary.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Matches part of the name or of another name, ignoring case. */
  applySearch(): void {
    const term = this.term.trim().toLowerCase();
    this.filtered = this.exercises.filter(
      (exercise) =>
        !term ||
        [exercise.name, ...exercise.aliases].some((name) =>
          name.toLowerCase().includes(term),
        ),
    );
  }

  clearSearch(): void {
    this.term = '';
    this.applySearch();
  }
}
