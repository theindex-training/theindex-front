import type { SegmentedOption } from '../components/segmented-control/segmented-control.component';

/**
 * The main filter of the Trainees and Trainers lists: everyone, or only the profiles that are (or
 * aren't) connected to an app account. Deleted (inactive) profiles are never listed at all.
 */
export type AccountFilter = 'all' | 'withAccount' | 'withoutAccount';

/** Segmented control options; labels are translation keys. */
export const ACCOUNT_FILTER_OPTIONS: SegmentedOption<AccountFilter>[] = [
  { value: 'all', label: 'common.all' },
  { value: 'withAccount', label: 'common.accountFilter.withAccount' },
  { value: 'withoutAccount', label: 'common.accountFilter.withoutAccount' },
];

export function matchesAccountFilter(
  profile: { accountId: string | null },
  filter: AccountFilter,
): boolean {
  if (filter === 'withAccount') {
    return Boolean(profile.accountId);
  }
  if (filter === 'withoutAccount') {
    return !profile.accountId;
  }
  return true;
}
