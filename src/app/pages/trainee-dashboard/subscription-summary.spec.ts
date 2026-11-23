import { Subscription } from '../../services/subscriptions.service';
import { subscriptionSummary } from './subscription-summary';

const TODAY = '2026-11-21';

function punch(remainingCredits: number, status = 'ACTIVE'): Subscription {
  return {
    id: `p${remainingCredits}`,
    traineeId: 't',
    planId: 'plan',
    type: 'PUNCH',
    status,
    paidCents: 5000,
    startsAt: '2026-11-01',
    endsAt: null,
    initialCredits: 10,
    remainingCredits,
  };
}

function time(endsAt: string, status = 'ACTIVE'): Subscription {
  return {
    id: `t${endsAt}`,
    traineeId: 't',
    planId: 'plan',
    type: 'TIME',
    status,
    paidCents: 9000,
    startsAt: '2026-11-01',
    endsAt,
    initialCredits: null,
    remainingCredits: null,
  };
}

describe('subscriptionSummary', () => {
  it('is NONE without an active subscription', () => {
    expect(
      subscriptionSummary(
        [punch(0, 'EXHAUSTED'), time('2026-11-01T00:00:00Z', 'EXPIRED')],
        TODAY,
      ),
    ).toEqual({
      level: 'NONE',
      creditsLeft: null,
      endsOn: null,
      daysLeft: null,
    });
  });

  it.each([
    [1, 'LAST'],
    [2, 'LOW'],
    [3, 'OK'],
  ] as const)('sums punch cards: %i left is %s', (credits, level) => {
    expect(subscriptionSummary([punch(credits)], TODAY)).toMatchObject({
      level,
      creditsLeft: credits,
    });
  });

  it('adds up the trainings left on several active punch cards', () => {
    expect(
      subscriptionSummary([punch(1), punch(2), punch(9, 'EXHAUSTED')], TODAY),
    ).toMatchObject({ level: 'OK', creditsLeft: 3 });
  });

  it.each([
    // Ends on the Sofia day of the timestamp: 23:30Z on the 20th is the 21st in Sofia.
    ['2026-11-20T23:30:00Z', 0, 'LAST'],
    ['2026-11-28T12:00:00Z', 7, 'LOW'],
    ['2026-11-29T12:00:00Z', 8, 'OK'],
  ] as const)(
    'counts a time pass ending %s as %i days left (%s)',
    (endsAt, daysLeft, level) => {
      expect(subscriptionSummary([time(endsAt)], TODAY)).toMatchObject({
        level,
        daysLeft,
      });
    },
  );

  it('counts a pass ending at Sofia midnight (a month plan) to its last day, the day before', () => {
    // Ends Nov 22 00:00 Sofia: today (Nov 21) is its last day.
    expect(subscriptionSummary([time('2026-11-21T22:00:00Z')], TODAY)).toEqual({
      level: 'LAST',
      creditsLeft: null,
      endsOn: '2026-11-21',
      daysLeft: 0,
    });
    // Ends Nov 23 00:00 Sofia: last day Nov 22, one day after today.
    expect(
      subscriptionSummary([time('2026-11-22T22:00:00Z')], TODAY),
    ).toMatchObject({ level: 'LOW', endsOn: '2026-11-22', daysLeft: 1 });
  });

  it('takes the latest end of several time passes', () => {
    expect(
      subscriptionSummary(
        [time('2026-11-23T10:00:00Z'), time('2026-12-21T10:00:00Z')],
        TODAY,
      ),
    ).toMatchObject({ level: 'OK', endsOn: '2026-12-21', daysLeft: 30 });
  });

  it('lets the subscription that lasts best decide with both kinds', () => {
    expect(
      subscriptionSummary([punch(1), time('2026-12-21T10:00:00Z')], TODAY),
    ).toEqual({
      level: 'OK',
      creditsLeft: 1,
      endsOn: '2026-12-21',
      daysLeft: 30,
    });
  });
});
