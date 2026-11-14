import { matchesAccountFilter } from './account-filter.util';

describe('matchesAccountFilter', () => {
  const linked = { accountId: 'acc1' };
  const unlinked = { accountId: null };

  it('keeps everyone for "all"', () => {
    expect(matchesAccountFilter(linked, 'all')).toBe(true);
    expect(matchesAccountFilter(unlinked, 'all')).toBe(true);
  });

  it('keeps only profiles connected to an account for "withAccount"', () => {
    expect(matchesAccountFilter(linked, 'withAccount')).toBe(true);
    expect(matchesAccountFilter(unlinked, 'withAccount')).toBe(false);
  });

  it('keeps only profiles without an account for "withoutAccount"', () => {
    expect(matchesAccountFilter(linked, 'withoutAccount')).toBe(false);
    expect(matchesAccountFilter(unlinked, 'withoutAccount')).toBe(true);
  });
});
