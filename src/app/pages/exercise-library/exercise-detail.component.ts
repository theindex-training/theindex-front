import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { Exercise, ExercisesService } from '../../services/exercises.service';
import { ExerciseVideoComponent } from '../trainee-schedule/exercise-video.component';

/**
 * An exercise of the trainees' library: its name, other names, video (played in the page) and
 * description. An inactive one is not found (the API's 404).
 */
@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
    ExerciseVideoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './exercise-detail.component.html',
  styleUrl: './exercise-detail.component.scss',
})
export class ExerciseDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exercisesService = inject(ExercisesService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private request?: Subscription;

  exercise: Exercise | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  ngOnInit(): void {
    // The page is reused when only the id changes.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.load(params.get('id') ?? ''));
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  private load(id: string): void {
    this.request?.unsubscribe();
    this.exercise = null;
    this.loading = true;
    this.errorMessage = null;
    this.changeDetector.markForCheck();

    this.request = this.exercisesService.getById(id).subscribe({
      next: (exercise) => {
        this.exercise = exercise;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'exerciseLibrary.detail.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
