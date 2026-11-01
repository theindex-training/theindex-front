import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { TraineeTrainingInsights, TraineesService } from '../../services/trainees.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  RankedItem,
  RankedListComponent
} from '../../components/ranked-list/ranked-list.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';
import { LocaleFormatService } from '../../i18n/locale-format.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    UiMessagePipe, 
    TranslocoPipe, 
    EmptyStateComponent,
    PageHeaderComponent,
    RankedListComponent,
    SkeletonListComponent
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  readonly format = inject(LocaleFormatService);
  loading = true;
  errorMessage: UiMessage | null = null;
  insights: TraineeTrainingInsights | null = null;

  constructor(
    private readonly traineesService: TraineesService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInsights();
  }

  get partners(): RankedItem[] {
    return (this.insights?.topTrainingPartners ?? []).map(item => ({
      label: item.traineeName,
      value: item.trainingsTogether
    }));
  }

  get weekdays(): RankedItem[] {
    return (this.insights?.topWeekdays ?? []).map(item => ({
      // The API sends an English day name plus the ISO number (1 = Monday); localize from the number.
      label: item.weekdayNumber ? this.format.weekday(item.weekdayNumber) : item.weekday,
      value: item.trainingsCount
    }));
  }

  get timeSlots(): RankedItem[] {
    return (this.insights?.topTimeSlots ?? []).map(item => ({
      label: item.timeSlot,
      value: item.trainingsCount
    }));
  }

  get trainers(): RankedItem[] {
    return (this.insights?.topTrainers ?? []).map(item => ({
      label: item.trainerName,
      value: item.trainingsCount
    }));
  }

  get gyms(): RankedItem[] {
    return (this.insights?.topGyms ?? []).map(item => ({
      label: item.gymName,
      value: item.trainingsCount
    }));
  }

  private loadInsights(): void {
    this.loading = true;
    this.errorMessage = null;

    this.traineesService.getMyTrainingInsights().subscribe({
      next: insights => {
        this.insights = insights;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage =
          apiErrorMessage(error, 'stats.loadErrorMessage');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
