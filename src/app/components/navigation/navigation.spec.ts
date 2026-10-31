import { buildNavigation, isUrlInItems } from './navigation';

const labels = (items: { label: string }[]) => items.map(item => item.label);

describe('buildNavigation', () => {
  it('gives admins every item, with Register as the primary tab', () => {
    const nav = buildNavigation('ADMIN');

    expect(labels(nav.main)).toEqual([
      'Dashboard',
      'Trainees',
      'Register attendance',
      'Attendance history',
      'Settlements',
      'Cash register'
    ]);
    expect(labels(nav.manage)).toEqual(['Plans', 'Gyms', 'Gym subscriptions', 'Trainers', 'Training times']);
    expect(nav.tabs.map(tab => tab.tabLabel ?? tab.label)).toEqual(['Home', 'Trainees', 'Register', 'Settle']);
    expect(nav.tabs.filter(tab => tab.primary).map(tab => tab.route)).toEqual(['/attendance/new']);
    expect(labels(nav.moreMain)).toEqual(['Attendance history', 'Cash register']);
    expect(nav.sheetLabel).toBe('More');
  });

  it('hides ADMIN-only items (Cash register, Trainers) from trainers', () => {
    const nav = buildNavigation('TRAINER');
    const all = labels([...nav.main, ...nav.manage, ...nav.moreMain, ...nav.moreManage]);

    expect(all).not.toContain('Cash register');
    expect(all).not.toContain('Trainers');
    expect(labels(nav.moreMain)).toEqual(['Attendance history']);
  });

  it('gives trainees their own three tabs and an Account sheet', () => {
    const nav = buildNavigation('TRAINEE');

    expect(labels(nav.main)).toEqual(['Profile', 'Stats', 'Records']);
    expect(labels(nav.tabs)).toEqual(['Profile', 'Stats', 'Records']);
    expect(nav.manage).toEqual([]);
    expect(nav.moreMain).toEqual([]);
    expect(nav.sheetLabel).toBe('Account');
  });

  it('shows only unrestricted items when the role is unknown', () => {
    const all = labels([...buildNavigation(null).main, ...buildNavigation(null).manage]);

    expect(all).not.toContain('Cash register');
    expect(all).not.toContain('Trainers');
  });
});

describe('isUrlInItems', () => {
  const { moreMain, moreManage } = buildNavigation('ADMIN');
  const sheetItems = [...moreMain, ...moreManage];

  it('matches sheet routes and their child pages', () => {
    expect(isUrlInItems('/plans', sheetItems)).toBe(true);
    expect(isUrlInItems('/plans/p1/edit', sheetItems)).toBe(true);
    expect(isUrlInItems('/gym-subscriptions?active=true', sheetItems)).toBe(true);
  });

  it('matches exact-only items exactly', () => {
    expect(isUrlInItems('/attendance', sheetItems)).toBe(true);
    expect(isUrlInItems('/attendance/new', sheetItems)).toBe(false);
  });

  it('does not match tab-bar pages or lookalike prefixes', () => {
    expect(isUrlInItems('/home', sheetItems)).toBe(false);
    expect(isUrlInItems('/trainees/t1', sheetItems)).toBe(false);
    expect(isUrlInItems('/plansx', sheetItems)).toBe(false);
  });
});
