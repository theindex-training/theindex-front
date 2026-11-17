import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';

/**
 * The plan to preselect when selling a trainee a subscription: the plan of
 * their latest active subscription, else of their latest subscription of any
 * status (a renewal usually repeats it), skipping plans that are no longer
 * offered. A trainee without one gets the first plan offered.
 */
export function defaultPlanId(
  plans: readonly Plan[],
  subscriptions: readonly Subscription[],
): string | null {
  if (!plans.length) {
    return null;
  }

  const offered = new Set(plans.map((plan) => plan.id));
  const candidates = subscriptions
    .filter((subscription) => offered.has(subscription.planId))
    .sort(newestFirst);
  const latest =
    candidates.find(
      (subscription) => subscription.status.toUpperCase() === 'ACTIVE',
    ) ?? candidates[0];

  return latest?.planId ?? plans[0].id;
}

function newestFirst(a: Subscription, b: Subscription): number {
  return (
    time(b.startsAt) - time(a.startsAt) || time(b.createdAt) - time(a.createdAt)
  );
}

function time(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
