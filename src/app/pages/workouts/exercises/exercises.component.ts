import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ChipComponent } from '../../../components/chip/chip.component';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { IconComponent } from '../../../components/icon/icon.component';
import { ListRowComponent } from '../../../components/list-row/list-row.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SearchFieldComponent } from '../../../components/search-field/search-field.component';
import {
  SegmentedControlComponent,
  SegmentedOption,
} from '../../../components/segmented-control/segmented-control.component';
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { StatusDotComponent } from '../../../components/status-dot/status-dot.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  Exercise,
  ExercisesService,
} from '../../../services/exercises.service';
import { WorkoutsNavComponent } from '../workouts-nav.component';

type StatusFilter = 'all' | 'active' | 'inactive';

/** The movement catalogue. Everything is loaded once; the search and the filter work on it. */
@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    WorkoutsNavComponent,
    SearchFieldComponent,
    SegmentedControlComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
    ChipComponent,
    StatusDotComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './exercises.component.html',
})
export class ExercisesComponent implements OnInit {
  readonly statusOptions: SegmentedOption<StatusFilter>[] = [
    { value: 'all', label: 'common.all' },
    { value: 'active', label: 'common.active' },
    { value: 'inactive', label: 'common.inactive' },
  ];

  exercises: Exercise[] = [];
  filtered: Exercise[] = [];
  term = '';
  status: StatusFilter = 'all';
  loading = true;
  errorMessage: UiMessage | null = null;

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

    this.exercisesService.list().subscribe({
      next: (exercises) => {
        this.exercises = exercises;
        this.applyFilters();
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.exercises.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  /** Matches part of the name or of an alias, ignoring case. */
  applyFilters(): void {
    const term = this.term.trim().toLowerCase();
    this.filtered = this.exercises.filter(
      (exercise) =>
        (this.status === 'all' ||
          exercise.isActive === (this.status === 'active')) &&
        (!term ||
          [exercise.name, ...exercise.aliases].some((name) =>
            name.toLowerCase().includes(term),
          )),
    );
  }

  clearFilters(): void {
    this.term = '';
    this.status = 'all';
    this.applyFilters();
  }
}
