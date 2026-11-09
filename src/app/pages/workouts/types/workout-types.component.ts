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
import { SkeletonListComponent } from '../../../components/skeleton-list/skeleton-list.component';
import { EnumLabelPipe } from '../../../i18n/enum-label.pipe';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import {
  WorkoutType,
  WorkoutTypesService,
} from '../../../services/workout-types.service';
import { WorkoutsNavComponent } from '../workouts-nav.component';

/** Workout types: the built-in ones first, then the trainers' own (the API orders them). */
@Component({
  selector: 'app-workout-types',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    UiMessagePipe,
    EnumLabelPipe,
    PageHeaderComponent,
    WorkoutsNavComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
    ChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './workout-types.component.html',
})
export class WorkoutTypesComponent implements OnInit {
  types: WorkoutType[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly typesService: WorkoutTypesService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = null;

    this.typesService.list().subscribe({
      next: (types) => {
        this.types = types;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'workouts.types.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
