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
  /** Roles that may see the item; omitted means every role the route allows. */
  roles?: string[];
}

export interface Navigation {
  /** Top-level items (desktop sidebar). */
  main: NavItem[];
  /** The "Manage" group (desktop sidebar). Empty for trainees. */
  manage: NavItem[];
  /** Items in the mobile tab bar, before the "More"/"Account" button. */
  tabs: NavItem[];
  /** Items that don't fit the tab bar; shown in the mobile sheet. */
  moreMain: NavItem[];
  moreManage: NavItem[];
  /** Translation key of the tab that opens the sheet: 'nav.more' (staff) or 'nav.account' (trainees). */
  sheetLabel: 'nav.more' | 'nav.account';
}

const STAFF_MAIN: NavItem[] = [
  { label: 'nav.dashboard', tabLabel: 'nav.home', route: '/home', icon: 'home' },
  { label: 'nav.trainees', route: '/trainees', icon: 'users' },
  { label: 'nav.registerAttendance', tabLabel: 'nav.register', route: '/attendance/new', icon: 'check', primary: true },
  { label: 'nav.attendanceHistory', route: '/attendance', icon: 'history', exact: true },
  { label: 'nav.settlements', tabLabel: 'nav.settle', route: '/settlements', icon: 'wallet' },
  { label: 'nav.cashRegister', route: '/cash-register', icon: 'banknote', roles: ['ADMIN'] }
];

const STAFF_MANAGE: NavItem[] = [
  { label: 'nav.plans', route: '/plans', icon: 'clipboard' },
  { label: 'nav.gyms', route: '/gyms', icon: 'dumbbell' },
  { label: 'nav.gymSubscriptions', route: '/gym-subscriptions', icon: 'ticket' },
  { label: 'nav.trainers', route: '/trainers', icon: 'trainer', roles: ['ADMIN'] },
  { label: 'nav.trainingTimes', route: '/training-times', icon: 'clock' }
];

const STAFF_TAB_ROUTES = ['/home', '/trainees', '/attendance/new', '/settlements'];

const TRAINEE_MAIN: NavItem[] = [
  { label: 'nav.profile', route: '/my-profile', icon: 'user' },
  { label: 'nav.stats', route: '/stats', icon: 'chart' },
  { label: 'nav.records', route: '/records', icon: 'trophy' }
];

function visibleTo(items: NavItem[], role: string | null): NavItem[] {
  return items.filter(item => !item.roles || (!!role && item.roles.includes(role)));
}

/** Navigation for a role. Role checks here only shape the UI; routes are still guarded by roleGuard. */
export function buildNavigation(role: string | null): Navigation {
  if (role === 'TRAINEE') {
    // Trainees have three destinations, so all fit in the tab bar; the fourth tab holds theme and account.
    return {
      main: TRAINEE_MAIN,
      manage: [],
      tabs: TRAINEE_MAIN,
      moreMain: [],
      moreManage: [],
      sheetLabel: 'nav.account'
    };
  }

  const main = visibleTo(STAFF_MAIN, role);
  const manage = visibleTo(STAFF_MANAGE, role);
  const isTab = (item: NavItem) => STAFF_TAB_ROUTES.includes(item.route);

  return {
    main,
    manage,
    tabs: main.filter(isTab),
    moreMain: main.filter(item => !isTab(item)),
    moreManage: manage,
    sheetLabel: 'nav.more'
  };
}

/** Whether the URL belongs to one of the items (used to highlight the "More" tab). */
export function isUrlInItems(url: string, items: NavItem[]): boolean {
  const path = url.split(/[?#]/)[0];
  return items.some(item =>
    item.exact ? path === item.route : path === item.route || path.startsWith(`${item.route}/`)
  );
}
