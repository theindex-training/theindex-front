import { ComponentFixture, TestBed } from '@angular/core/testing';
import en from '../../../../public/i18n/en.json';
import { LocaleFormatService } from '../../i18n/locale-format.service';
import { Plan } from '../../services/plans.service';
import { Subscription } from '../../services/subscriptions.service';
import { TraineeSubscriptionsTableComponent } from './trainee-subscriptions-table.component';

const PLANS: Plan[] = [
  {
    id: 'p1',
    type: 'PUNCH',
    title: '10 visits',
    priceCents: 4550,
    credits: 10,
    durationDays: null,
    isActive: true,
  },
];

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    traineeId: 't1',
    planId: 'p1',
    type: 'PUNCH',
    status: 'ACTIVE',
    paidCents: 4550,
    startsAt: '2026-10-01',
    endsAt: null,
    initialCredits: 10,
    remainingCredits: 7,
    ...overrides,
  };
}

describe('TraineeSubscriptionsTableComponent', () => {
  let fixture: ComponentFixture<TraineeSubscriptionsTableComponent>;
  let component: TraineeSubscriptionsTableComponent;
  let el: HTMLElement;

  async function render(
    inputs: Partial<Record<keyof TraineeSubscriptionsTableComponent, unknown>>,
  ) {
    fixture = TestBed.createComponent(TraineeSubscriptionsTableComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    for (const [name, value] of Object.entries({ plans: PLANS, ...inputs })) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  const deleteButtons = () =>
    Array.from(
      el.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Delete subscription"]',
      ),
    );

  it('names the plan by title, or by its id when the plan is unknown', async () => {
    await render({
      subscriptions: [
        subscription(),
        subscription({ id: 's2', planId: 'gone' }),
      ],
    });

    expect(component.formatPlanLabel(subscription())).toBe('10 visits');
    expect(component.formatPlanLabel(subscription({ planId: 'gone' }))).toBe(
      'gone',
    );
    expect(el.textContent).toContain('gone');
  });

  it('shows credits used for a punch card and the end date for a time-based plan', async () => {
    await render({ subscriptions: [] });
    const format = TestBed.inject(LocaleFormatService);

    expect(component.formatEndsOrCredits(subscription())).toBe(
      '3 / 10 trainings',
    );
    expect(
      component.formatEndsOrCredits(
        subscription({ initialCredits: 1, remainingCredits: 0 }),
      ),
    ).toBe('1 / 1 training');
    expect(
      component.formatEndsOrCredits(
        subscription({ initialCredits: null, remainingCredits: null }),
      ),
    ).toBe('0 / 0 trainings');
    // More remaining than bought never shows a negative count.
    expect(
      component.formatEndsOrCredits(
        subscription({ initialCredits: 5, remainingCredits: 8 }),
      ),
    ).toBe('0 / 5 trainings');
    expect(
      component.formatEndsOrCredits(
        subscription({ type: 'TIME', endsAt: '2026-11-30' }),
      ),
    ).toBe(format.date('2026-11-30'));
  });

  it.each([
    ['ACTIVE', 'success'],
    ['active', 'success'],
    ['EXHAUSTED', 'danger'],
    ['EXPIRED', 'neutral'],
    ['CANCELLED', 'neutral'],
  ])('status %s gets the %s tone', async (status, tone) => {
    await render({ subscriptions: [] });

    expect(component.statusTone(subscription({ status }))).toBe(tone);
  });

  it('shows the loading, error and empty states', async () => {
    await render({ loading: true, subscriptions: [subscription()] });
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      en.subscriptions.loading,
    );

    await render({ errorMessage: { text: 'Server down' }, subscriptions: [] });
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Server down',
    );

    await render({
      subscriptions: [],
      emptyKey: 'traineeDashboard.noActiveSubscriptions',
    });
    expect(el.textContent).toContain(en.traineeDashboard.noActiveSubscriptions);
  });

  it('keeps showing loaded rows when an error arrives later', async () => {
    await render({
      errorMessage: { text: 'Delete failed' },
      subscriptions: [subscription()],
    });

    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('10 visits');
  });

  it('offers delete only when allowed, and only with the actions column', async () => {
    await render({ subscriptions: [subscription()] });
    expect(deleteButtons().length).toBe(0);

    await render({
      subscriptions: [subscription()],
      canDeleteSubscriptions: true,
      showActionsColumn: false,
    });
    expect(deleteButtons().length).toBe(0);

    await render({
      subscriptions: [subscription()],
      canDeleteSubscriptions: true,
    });
    expect(deleteButtons().length).toBe(2); // table + phone list
    expect(deleteButtons()[0].getAttribute('aria-label')).toBe(
      'Delete subscription 10 visits',
    );
  });

  it('emits the subscription to delete, and disables its button while deleting', async () => {
    await render({
      subscriptions: [subscription()],
      canDeleteSubscriptions: true,
    });
    const requested: Subscription[] = [];
    component.deleteSubscriptionRequested.subscribe((value) =>
      requested.push(value),
    );

    deleteButtons()[0].click();
    expect(requested.map((item) => item.id)).toEqual(['s1']);

    fixture.componentRef.setInput('deletingSubscriptionId', 's1');
    await fixture.whenStable();
    expect(deleteButtons().every((button) => button.disabled)).toBe(true);
  });
});
