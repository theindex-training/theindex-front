import en from '../../../../public/i18n/en.json';
import {
  NavGroup,
  NavItem,
  buildNavigation,
  isItemActive,
  isUrlInItems,
} from './navigation';

// Nav labels are translation keys; resolve them to the English text to keep the expectations readable.
const english = (key: string): string =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)?.[part],
      en,
    ) as string;
const labels = (items: { label: string }[]) =>
  items.map((item) => english(item.label));
/** Each group as "Heading: item, item". */
const outline = (groups: NavGroup[]) =>
  groups.map(
    (group) =>
      `${group.label ? english(group.label) : '—'}: ${labels(group.items).join(', ')}`,
  );
const itemsOf = (groups: NavGroup[]): NavItem[] =>
  groups.flatMap((group) => group.items);

describe('buildNavigation', () => {
  it('groups the admin sidebar by what people do, daily work first', () => {
    const nav = buildNavigation('ADMIN');

    expect(outline(nav.groups)).toEqual([
      'Daily: Dashboard, Schedule, Register attendance, Attendance history',
      'People: Trainees, Renewals',
      'Training: Workouts, Records',
      'Money: Settlements, Cash register',
      'Manage: Plans, Gyms, Gym subscriptions, Trainers, Accounts, Training times, Content',
    ]);
  });

  it('gives staff the daily pages as tabs, with Register as the primary one, and the rest in More', () => {
    const nav = buildNavigation('ADMIN');

    expect(nav.tabs.map((tab) => english(tab.tabLabel ?? tab.label))).toEqual([
      'Home',
      'Schedule',
      'Register',
      'Trainees',
    ]);
    expect(
      nav.tabs.filter((tab) => tab.primary).map((tab) => tab.route),
    ).toEqual(['/attendance/new']);
    expect(nav.tabs.find((tab) => tab.label === 'nav.schedule')?.route).toBe(
      '/workouts/schedule',
    );
    expect(outline(nav.sheetGroups)).toEqual([
      'Daily: Attendance history',
      'People: Renewals',
      'Training: Workouts, Records',
      'Money: Settlements, Cash register',
      'Manage: Plans, Gyms, Gym subscriptions, Trainers, Accounts, Training times, Content',
    ]);
    expect(english(nav.sheetLabel)).toBe('More');
  });

  it('hides ADMIN-only items (Cash register, Trainers, Accounts, Content) from trainers', () => {
    const nav = buildNavigation('TRAINER');
    const all = labels([...itemsOf(nav.groups), ...itemsOf(nav.sheetGroups)]);

    expect(all).not.toContain('Cash register');
    expect(all).not.toContain('Trainers');
    expect(all).not.toContain('Accounts');
    expect(all).not.toContain('Content');
    expect(outline(nav.sheetGroups)).toEqual([
      'Daily: Attendance history',
      'People: Renewals',
      'Training: Workouts, Records',
      'Money: Settlements',
      'Manage: Plans, Gyms, Gym subscriptions, Training times',
    ]);
  });

  it('gives trainees Home first, four tabs and an Account sheet with Stats', () => {
    const nav = buildNavigation('TRAINEE');

    expect(outline(nav.groups)).toEqual([
      '—: Home, Schedule, Exercises, Stats, Records',
    ]);
    expect(nav.groups[0].items[0].route).toBe('/home');
    expect(labels(nav.tabs)).toEqual([
      'Home',
      'Schedule',
      'Exercises',
      'Records',
    ]);
    expect(nav.tabs.some((tab) => tab.primary)).toBe(false);
    expect(outline(nav.sheetGroups)).toEqual(['—: Stats']);
    expect(english(nav.sheetLabel)).toBe('Account');
    const sheet = itemsOf(nav.sheetGroups);
    expect(isUrlInItems('/stats', sheet)).toBe(true);
    expect(isUrlInItems('/exercises/e1', sheet)).toBe(false);
  });

  it('shows only unrestricted items when the role is unknown', () => {
    const all = labels(itemsOf(buildNavigation(null).groups));

    expect(all).not.toContain('Cash register');
    expect(all).not.toContain('Trainers');
    expect(all).not.toContain('Accounts');
    expect(all).not.toContain('Content');
  });
});

describe('isItemActive', () => {
  const items = itemsOf(buildNavigation('ADMIN').groups);
  const item = (label: string) =>
    items.find((candidate) => english(candidate.label) === label)!;
  const active = (url: string) =>
    items
      .filter((candidate) => isItemActive(url, candidate))
      .map((candidate) => english(candidate.label));

  it('marks Schedule, not Workouts, on the schedule and its trainings', () => {
    expect(active('/workouts/schedule')).toEqual(['Schedule']);
    expect(active('/workouts/schedule/s1?gym=g1')).toEqual(['Schedule']);
  });

  it('marks Workouts on the rest of the workouts area', () => {
    expect(active('/workouts?week=2026-11-16')).toEqual(['Workouts']);
    expect(active('/workouts/exercises')).toEqual(['Workouts']);
    expect(active('/workouts/w1/edit')).toEqual(['Workouts']);
    // A lookalike of the excluded page isn't excluded.
    expect(isItemActive('/workouts/schedules', item('Workouts'))).toBe(true);
  });

  it('marks exact-only items on their own page only', () => {
    expect(active('/attendance')).toEqual(['Attendance history']);
    expect(active('/attendance/new?date=2026-11-21')).toEqual([
      'Register attendance',
    ]);
  });
});

describe('isUrlInItems', () => {
  const sheetItems = itemsOf(buildNavigation('ADMIN').sheetGroups);

  it('matches sheet routes and their child pages', () => {
    expect(isUrlInItems('/plans', sheetItems)).toBe(true);
    expect(isUrlInItems('/plans/p1/edit', sheetItems)).toBe(true);
    expect(isUrlInItems('/content/categories/c1/edit', sheetItems)).toBe(true);
    expect(isUrlInItems('/gym-subscriptions?active=true', sheetItems)).toBe(
      true,
    );
    expect(isUrlInItems('/settlements/s1', sheetItems)).toBe(true);
  });

  it('matches exact-only items exactly', () => {
    expect(isUrlInItems('/attendance', sheetItems)).toBe(true);
    expect(isUrlInItems('/attendance/new', sheetItems)).toBe(false);
  });

  it('does not match tab-bar pages or lookalike prefixes', () => {
    expect(isUrlInItems('/home', sheetItems)).toBe(false);
    expect(isUrlInItems('/trainees/t1', sheetItems)).toBe(false);
    // The schedule is a tab, though it lives under Workouts (a sheet item).
    expect(isUrlInItems('/workouts/schedule', sheetItems)).toBe(false);
    expect(isUrlInItems('/plansx', sheetItems)).toBe(false);
  });
});
