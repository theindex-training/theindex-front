import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { LanguageService } from '../../i18n/language.service';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { UiMessage } from '../../i18n/ui-message';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { ChipComponent, ChipTone } from '../chip/chip.component';
import { IconComponent } from '../icon/icon.component';
import { SkeletonListComponent } from '../skeleton-list/skeleton-list.component';
import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';

@Component({
  selector: 'app-trainee-subscriptions-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    EnumLabelPipe,
    UiMessagePipe,
    ChipComponent,
    IconComponent,
    SkeletonListComponent
  ],
  templateUrl: './trainee-subscriptions-table.component.html'
})
export class TraineeSubscriptionsTableComponent {
  readonly format = inject(LocaleFormatService);
  private readonly i18n = inject(LanguageService);

  @Input() subscriptions: Subscription[] = [];
  @Input() plans: Plan[] = [];
  @Input() loading = false;
  @Input() errorMessage: UiMessage | null = null;
  /** Translation key of the message shown when there are no subscriptions. */
  @Input() emptyKey = 'subscriptions.empty';
  @Input() canDeleteSubscriptions = false;
  @Input() deletingSubscriptionId: string | null = null;
  @Input() showActionsColumn = true;

  @Output() deleteSubscriptionRequested = new EventEmitter<Subscription>();

  formatPlanLabel(subscription: Subscription): string {
    const plan = this.plans.find(entry => entry.id === subscription.planId);
    return plan ? plan.title : subscription.planId;
  }

  formatEndsOrCredits(subscription: Subscription): string {
    if (subscription.type === 'TIME') {
      return this.format.date(subscription.endsAt);
    }

    const initial = subscription.initialCredits ?? 0;
    const remaining = subscription.remainingCredits ?? 0;
    const used = Math.max(initial - remaining, 0);
    return this.i18n.t('subscriptions.creditsUsed', { used, total: initial });
  }

  statusTone(subscription: Subscription): ChipTone {
    if (this.isActiveSubscription(subscription)) {
      return 'success';
    }
    return this.isExhausted(subscription) ? 'danger' : 'neutral';
  }

  isExhausted(subscription: Subscription): boolean {
    return subscription.status.toUpperCase() === 'EXHAUSTED';
  }

  isActiveSubscription(subscription: Subscription): boolean {
    return subscription.status.toUpperCase() === 'ACTIVE';
  }

  onDelete(subscription: Subscription): void {
    this.deleteSubscriptionRequested.emit(subscription);
  }
}
