import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';

@Component({
  selector: 'app-trainee-subscriptions-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trainee-subscriptions-table.component.html',
  styleUrl: './trainee-subscriptions-table.component.scss',
})
export class TraineeSubscriptionsTableComponent {
  @Input() subscriptions: Subscription[] = [];
  @Input() plans: Plan[] = [];
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() emptyMessage = 'No subscriptions yet.';
  @Input() canDeleteSubscriptions = false;
  @Input() deletingSubscriptionId: string | null = null;

  @Output() deleteSubscriptionRequested = new EventEmitter<Subscription>();

  formatPlanLabel(subscription: Subscription): string {
    const plan = this.plans.find(entry => entry.id === subscription.planId);
    return plan ? plan.title : subscription.planId;
  }

  formatEndsOrCredits(subscription: Subscription): string {
    if (subscription.type === 'TIME') {
      return subscription.endsAt ? this.formatDate(subscription.endsAt) : '—';
    }

    const initial = subscription.initialCredits ?? 0;
    const remaining = subscription.remainingCredits ?? 0;
    const used = Math.max(initial - remaining, 0);
    return `${used} / ${initial} trainings`;
  }

  isExhausted(subscription: Subscription): boolean {
    return subscription.status.toUpperCase() === 'EXHAUSTED';
  }

  isActiveSubscription(subscription: Subscription): boolean {
    return subscription.status.toUpperCase() === 'ACTIVE';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatPrice(priceCents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(priceCents / 100);
  }

  onDelete(subscription: Subscription): void {
    this.deleteSubscriptionRequested.emit(subscription);
  }
}
