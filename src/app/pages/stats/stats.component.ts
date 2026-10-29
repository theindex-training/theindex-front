import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { TraineeTrainingInsights, TraineesService } from '../../services/trainees.service';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import {
  RankedItem,
  RankedListComponent
} from '../../components/ranked-list/ranked-list.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    EmptyStateComponent,
    PageHeaderComponent,
    RankedListComponent,
    SkeletonListComponent
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss'
})
export class StatsComponent implements OnInit {
  loading = true;
  errorMessage = '';
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
      label: item.weekday,
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
    this.errorMessage = '';

    this.traineesService.getMyTrainingInsights().subscribe({
      next: insights => {
        this.insights = insights;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.errorMessage =
          error?.error?.message || 'Unable to load your training stats right now. Please try again later.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }
}
