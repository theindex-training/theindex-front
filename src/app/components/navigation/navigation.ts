import { IconName } from '../icon/icon.component';

export interface NavItem {
  /** Translation key, e.g. 'nav.trainees'. */
  label: string;
  route: string;
  icon: IconName;
  /** Translation key of a shorter label for the mobile tab bar. */
  tabLabel?: string;
  /** Highlighted as the primary action in the mobile tab bar. */
  primary?: boolean;
  /** Only mark active on an exact URL match (e.g. /attendance must not match /attendance/new). */
  exact?: boolean;
  /** Pages under `route` that belong to another item (e.g. /workouts/schedule is Schedule's). */
  excludes?: string[];
  /** Roles that may see the item; omitted means every role the route allows. */
  roles?: string[];
}

/** A labelled group of the sidebar and the sheet. */
export interface NavGroup {
  /** Used for the heading's id. */
  id: string;
  /** Translation key of the heading; null for a group shown without one (trainees). */
  label: string | null;
  items: NavItem[];
}

export interface Navigation {
  /** The sidebar's groups (desktop), in order. */
  groups: NavGroup[];
  /** Items in the mobile tab bar, before the "More"/"Account" button. */
  tabs: NavItem[];
  /** The groups' items that aren't tabs: the mobile sheet. Groups left empty are dropped. */
  sheetGroups: NavGroup[];
  /** Translation key of the tab that opens the sheet: 'nav.more' (staff) or 'nav.account' (trainees). */
  sheetLabel: 'nav.more' | 'nav.account';
}

const SCHEDULE_ROUTE = '/workouts/schedule';

/**
 * Staff navigation, grouped by what people do: the day's work first, then people, training
 * content, money and the catalogue.
 */
const STAFF_GROUPS: NavGroup[] = [
  {
    id: 'daily',
    label: 'nav.groups.daily',
    items: [
      {
        label: 'nav.dashboard',
        tabLabel: 'nav.home',
        route: '/home',
        icon: 'home',
      },
      { label: 'nav.schedule', route: SCHEDULE_ROUTE, icon: 'calendar' },
      {
        label: 'nav.registerAttendance',
        tabLabel: 'nav.register',
        route: '/attendance/new',
        icon: 'check',
        primary: true,
      },
      {
        label: 'nav.attendanceHistory',
        route: '/attendance',
        icon: 'history',
        exact: true,
      },
    ],
  },
  {
    id: 'people',
    label: 'nav.groups.people',
    items: [
      { label: 'nav.trainees', route: '/trainees', icon: 'users' },
      { label: 'nav.renewals', route: '/renewals', icon: 'renew' },
    ],
  },
  {
    id: 'training',
    label: 'nav.groups.training',
    items: [
      {
        label: 'nav.workouts',
        route: '/workouts',
        icon: 'timer',
        excludes: [SCHEDULE_ROUTE],
      },
      { label: 'nav.records', route: '/records', icon: 'trophy' },
    ],
  },
  {
    id: 'money',
    label: 'nav.groups.money',
    items: [
      { label: 'nav.settlements', route: '/settlements', icon: 'wallet' },
      {
        label: 'nav.cashRegister',
        route: '/cash-register',
        icon: 'banknote',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    id: 'manage',
    label: 'nav.manage',
    items: [
      { label: 'nav.plans', route: '/plans', icon: 'clipboard' },
      { label: 'nav.gyms', route: '/gyms', icon: 'dumbbell' },
      {
        label: 'nav.gymSubscriptions',
        route: '/gym-subscriptions',
        icon: 'ticket',
      },
      {
        label: 'nav.trainers',
        route: '/trainers',
        icon: 'trainer',
        roles: ['ADMIN'],
      },
      {
        label: 'nav.accounts',
        route: '/accounts',
        icon: 'user-plus',
        roles: ['ADMIN'],
      },
      { label: 'nav.trainingTimes', route: '/training-times', icon: 'clock' },
      {
        label: 'nav.content',
        route: '/content',
        icon: 'file-text',
        roles: ['ADMIN'],
      },
    ],
  },
];

/** What staff use every day; Settlements (twice a month) lives in the More sheet. */
const STAFF_TAB_ROUTES = [
  '/home',
  SCHEDULE_ROUTE,
  '/attendance/new',
  '/trainees',
];

const TRAINEE_ITEMS: NavItem[] = [
  { label: 'nav.home', route: '/home', icon: 'home' },
  { label: 'nav.schedule', route: '/schedule', icon: 'calendar' },
  { label: 'nav.exercises', route: '/exercises', icon: 'dumbbell' },
  { label: 'nav.stats', route: '/stats', icon: 'chart' },
  { label: 'nav.records', route: '/records', icon: 'trophy' },
];

/** Stats is used least, so on phones it is the one in the Account sheet. */
const TRAINEE_TAB_ROUTES = ['/home', '/schedule', '/exercises', '/records'];

function visibleTo(items: NavItem[], role: string | null): NavItem[] {
  return items.filter(
    (item) => !item.roles || (!!role && item.roles.includes(role)),
  );
}

/** Navigation for a role. Role checks here only shape the UI; routes are still guarded by roleGuard. */
export function buildNavigation(role: string | null): Navigation {
  const trainee = role === 'TRAINEE';
  const groups: NavGroup[] = trainee
    ? [{ id: 'main', label: null, items: TRAINEE_ITEMS }]
    : STAFF_GROUPS.map((group) => ({
        ...group,
        items: visibleTo(group.items, role),
      })).filter((group) => group.items.length);
  const tabRoutes = trainee ? TRAINEE_TAB_ROUTES : STAFF_TAB_ROUTES;
  const items = groups.flatMap((group) => group.items);

  return {
    groups,
    // Tabs in the tab bar's own order, not the sidebar's.
    tabs: tabRoutes
      .map((route) => items.find((item) => item.route === route))
      .filter((item): item is NavItem => !!item),
    sheetGroups: groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !tabRoutes.includes(item.route)),
      }))
      .filter((group) => group.items.length),
    sheetLabel: trainee ? 'nav.account' : 'nav.more',
  };
}

/** Whether the URL is the item's page (or, unless `exact`, one under it that isn't excluded). */
export function isItemActive(url: string, item: NavItem): boolean {
  const path = url.split(/[?#]/)[0];
  const under = (route: string) =>
    path === route || path.startsWith(`${route}/`);
  if (item.exact) {
    return path === item.route;
  }
  return under(item.route) && !(item.excludes ?? []).some(under);
}

/** Whether the URL belongs to one of the items (used to highlight the "More" tab). */
export function isUrlInItems(url: string, items: NavItem[]): boolean {
  return items.some((item) => isItemActive(url, item));
}
