import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import { TrainingTime, TrainingTimesService } from '../../services/training-times.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-training-times',
  standalone: true,
  imports: [
    UiMessagePipe, 
    TranslocoPipe, 
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent
  ],
  templateUrl: './training-times.component.html'
})
export class TrainingTimesComponent implements OnInit {
  trainingTimes: TrainingTime[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly trainingTimesService: TrainingTimesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTrainingTimes();
  }

  loadTrainingTimes(): void {
    this.loading = true;
    this.errorMessage = null;

    this.trainingTimesService.list().subscribe({
      next: (trainingTimes) => {
        this.trainingTimes = trainingTimes;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'trainingTimes.list.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  formatTime(value: string): string {
    return formatTimeWithoutSeconds(value);
  }
}
