import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService,
} from '../../services/gym-subscriptions.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';
import {
  recordLoadError,
  rejectDeleted,
} from '../../utils/deleted-record.util';

@Component({
  selector: 'app-gym-subscription-delete',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './gym-subscription-delete.component.html',
})
export class GymSubscriptionDeleteComponent implements OnInit {
  gymSubscription: GymSubscription | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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

  confirmDelete(): void {
    if (!this.gymSubscription) {
      return;
    }

    this.submitting = true;
    this.errorMessage = null;

    this.gymSubscriptionsService.deactivate(this.gymSubscription.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gym-subscriptions']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(
          error,
          'gymSubscriptions.delete.error',
        );
        this.submitting = false;
        this.changeDetector.detectChanges();
      },
    });
  }
}
