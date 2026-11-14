import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { SkeletonListComponent } from '../../components/skeleton-list/skeleton-list.component';
import { EmptyStateComponent } from '../../components/empty-state/empty-state.component';
import { ListRowComponent } from '../../components/list-row/list-row.component';
import { IconComponent } from '../../components/icon/icon.component';
import {
  GymSubscription,
  GymSubscriptionsService,
} from '../../services/gym-subscriptions.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-gym-subscriptions',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    RouterLink,
    PageHeaderComponent,
    SkeletonListComponent,
    EmptyStateComponent,
    ListRowComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './gym-subscriptions.component.html',
})
export class GymSubscriptionsComponent implements OnInit {
  gymSubscriptions: GymSubscription[] = [];
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadGymSubscriptions();
  }

  loadGymSubscriptions(): void {
    this.loading = true;
    this.errorMessage = null;

    // Without includeInactive the API lists the active ones only: deleting a gym subscription
    // deactivates it, and the app treats it as gone.
    this.gymSubscriptionsService.list().subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions = gymSubscriptions;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'gymSubscriptions.list.loadErrorMessage',
        );
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
