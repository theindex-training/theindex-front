import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';
import { defaultPlanId } from './default-plan';

function plan(id: string): Plan {
  return {
    id,
    type: 'PUNCH',
    title: id,
    priceCents: 1000,
    credits: 10,
    durationDays: null,
    durationMonths: null,
    isActive: true,
  };
}

function subscription(
  planId: string,
  startsAt: string,
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    id: `${planId}-${startsAt}`,
    traineeId: 'tr1',
    planId,
    type: 'PUNCH',
    status: 'ACTIVE',
    paidCents: 1000,
    startsAt,
    endsAt: null,
    initialCredits: 10,
    remainingCredits: 5,
    ...overrides,
  };
}

const PLANS = [plan('p1'), plan('p2'), plan('p3')];

describe('defaultPlanId', () => {
  it('is null without plans', () => {
    expect(defaultPlanId([], [subscription('p1', '2026-10-01')])).toBeNull();
  });

  it('is the first plan for a trainee without subscriptions', () => {
    expect(defaultPlanId(PLANS, [])).toBe('p1');
  });

  it('is the plan of the latest active subscription, whatever the list order', () => {
    const subscriptions = [
      subscription('p2', '2026-09-01T00:00:00.000Z'),
      subscription('p3', '2026-11-01T00:00:00.000Z'),
      subscription('p1', '2026-10-01T00:00:00.000Z'),
    ];

    expect(defaultPlanId(PLANS, subscriptions)).toBe('p3');
  });

  it('prefers an active subscription to a newer one that is used up (any case)', () => {
    const subscriptions = [
      subscription('p3', '2026-11-05', { status: 'EXHAUSTED' }),
      subscription('p2', '2026-11-01', { status: 'active' }),
    ];

    expect(defaultPlanId(PLANS, subscriptions)).toBe('p2');
  });

  it('falls back to the latest subscription of any status when none is active', () => {
    const subscriptions = [
      subscription('p2', '2026-08-01', { status: 'EXPIRED' }),
      subscription('p3', '2026-10-01', { status: 'EXHAUSTED' }),
    ];

    expect(defaultPlanId(PLANS, subscriptions)).toBe('p3');
  });

  it('breaks a tie on the start by the latest created', () => {
    const subscriptions = [
      subscription('p2', '2026-10-01', { createdAt: '2026-10-01T08:00:00Z' }),
      subscription('p3', '2026-10-01', { createdAt: '2026-10-01T09:00:00Z' }),
    ];

    expect(defaultPlanId(PLANS, subscriptions)).toBe('p3');
  });

  it('skips plans that are no longer offered', () => {
    const subscriptions = [
      subscription('retired', '2026-11-01'),
      subscription('p2', '2026-10-01', { status: 'EXHAUSTED' }),
    ];

    expect(defaultPlanId(PLANS, subscriptions)).toBe('p2');
    expect(defaultPlanId(PLANS, [subscription('retired', '2026-11-01')])).toBe(
      'p1',
    );
  });
});
