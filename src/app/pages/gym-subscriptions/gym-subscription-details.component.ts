import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService,
} from '../../services/gym-subscriptions.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { i18nMessage, UiMessage } from '../../i18n/ui-message';
import {
  recordLoadError,
  rejectDeleted,
} from '../../utils/deleted-record.util';

@Component({
  selector: 'app-gym-subscription-details',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    RouterLink,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './gym-subscription-details.component.html',
})
export class GymSubscriptionDetailsComponent implements OnInit {
  gymSubscription: GymSubscription | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('gymSubscriptions.errors.missingId');
      this.loading = false;
      return;
    }

    this.gymSubscriptionsService
      .getById(id)
      .pipe(rejectDeleted())
      .subscribe({
        next: (gymSubscription) => {
          this.gymSubscription = gymSubscription;
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.errorMessage = recordLoadError(
            error,
            'gymSubscriptions.errors.notFound',
            'gymSubscriptions.errors.load',
          );
          this.loading = false;
          this.changeDetector.detectChanges();
        },
      });
  }
}
