import { Page } from '@playwright/test';
import { mockStaffHome, plan } from '../support/data';
import { expect, storedToken, test } from '../support/fixtures';
import { t, tBg } from '../support/i18n';

/** TEST_PLAN.md J8: a trainee's own pages, the navigation sheet and their preferences. */
const subscription = (id: string, planId: string, status: string, type = 'PUNCH') => ({
  id,
  traineeId: 'trainee-1',
  planId,
  type,
  status,
  paidCents: 4550,
  startsAt: '2026-09-01',
  endsAt: type === 'TIME' ? '2026-09-30' : null,
  initialCredits: type === 'PUNCH' ? 10 : null,
  remainingCredits: type === 'PUNCH' ? (status === 'EXHAUSTED' ? 0 : 4) : null
});

function mockTraineeData(api: import('../support/api-mock').ApiMock) {
  api.on('GET', '/api/attendance/trainees/trainee-1', {
    body: [
      {
        id: 'a1',
        traineeId: 'trainee-1',
        trainerId: 'tr1',
        trainer: { id: 'tr1', name: 'Petar Petrov', nickname: 'Pepi' },
        locationId: 'g1',
        location: { id: 'g1', name: 'Center' },
        trainedAt: '2026-10-30T16:30:00Z',
        subscriptionId: 's-active',
        gymSubscriptionId: null,
        paymentStatus: 'PAID',
        createdAt: '2026-10-30T16:30:00Z'
      }
    ]
  });
  api.on('GET', '/api/trainees/trainee-1/subscriptions', {
    body: [
      subscription('s-active', 'p-ten', 'ACTIVE'),
      subscription('s-used', 'p-eight', 'EXHAUSTED'),
      subscription('s-old', 'p-month', 'EXPIRED', 'TIME')
    ]
  });
  api.on('GET', '/api/plans', {
    body: [
      plan('p-ten', 'Ten visits'),
      plan('p-eight', 'Eight pack', { isActive: false }),
      plan('p-month', 'Monthly', { type: 'TIME', credits: null, durationDays: 30, isActive: false })
    ]
  });
  api.on('GET', '/api/trainees/me/training-insights', {
    body: {
      traineeId: 'trainee-1',
      totalAttendances: 30,
      topTrainingPartners: [{ traineeId: 't2', traineeName: 'Georgi Ivanov', trainingsTogether: 12 }],
      topTrainers: [{ trainerId: 'tr1', trainerName: 'Petar Petrov', trainingsCount: 20 }],
      topGyms: [{ gymId: 'g1', gymName: 'Center', trainingsCount: 25 }],
      topWeekdays: [{ weekday: 'Monday', weekdayNumber: 1, trainingsCount: 10 }],
      topTimeSlots: [{ timeSlot: '18:00', trainingsCount: 15 }]
    }
  });
}

const tabs = (page: Page) => page.getByRole('navigation', { name: t('nav.mainLabel') });
/** Lists render twice (desktop table, phone list) and CSS hides one; only the visible copy counts. */
const shown = (page: Page, text: string) => page.getByText(text).filter({ visible: true });

/**
 * Segmented controls (filters, theme, language) use visually hidden radios inside their labels, as
 * users click the label. Pick by the group's name (its legend) and the option's visible text, then
 * check the radio's state by its accessible name.
 */
async function choose(scope: Page | import('@playwright/test').Locator, group: string, visibleText: string) {
  await scope.getByRole('group', { name: group }).getByText(visibleText, { exact: true }).click();
}

test.describe('J8 trainee self-service', () => {
  test('a trainee uses their pages, the Account sheet and their preferences on a phone', { tag: '@mobile' }, async ({ page, api, signInAs }) => {
    // The trainings calendar opens on the current month; fix the clock to the month of the training.
    await page.clock.setFixedTime(new Date('2026-10-31T12:00:00+02:00'));
    await signInAs('TRAINEE');
    mockTraineeData(api);

    // 1–2. My profile: active subscriptions first, then the other filters.
    await page.goto('/');
    await expect(page).toHaveURL(/\/my-profile$/);
    expect(api.last('GET', '/api/plans')?.query).toEqual({});
    await expect(shown(page, 'Ten visits')).toBeVisible();
    await expect(shown(page, 'Eight pack')).toHaveCount(0);
    await expect(shown(page, 'Pepi')).toBeVisible();

    await choose(page, t('traineeDashboard.subscriptionFilter'), t('subscriptions.filter.exhausted'));
    await expect(page.getByRole('radio', { name: t('subscriptions.filter.exhausted') })).toBeChecked();
    await expect(shown(page, 'Eight pack')).toBeVisible();
    await expect(shown(page, 'Ten visits')).toHaveCount(0);
    await choose(page, t('traineeDashboard.subscriptionFilter'), t('common.all'));
    await expect(shown(page, 'Monthly')).toBeVisible();

    // 3–4. Stats and Records from the tab bar.
    await tabs(page).getByRole('link', { name: t('nav.stats') }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByText('Georgi Ivanov')).toBeVisible();
    await expect(page.getByText('Monday')).toBeVisible();
    const requestsBeforeRecords = api.requests.length;
    await tabs(page).getByRole('link', { name: t('nav.records') }).click();
    await expect(page.getByText(t('records.comingSoon'))).toBeVisible();
    expect(api.requests.length).toBe(requestsBeforeRecords);

    // 5. The Account sheet is a modal dialog: focus moves in, Escape and a backdrop tap close it.
    const accountTab = tabs(page).getByRole('button', { name: t('nav.account') });
    const sheet = page.getByRole('dialog', { name: t('nav.account') });
    await expect(accountTab).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(accountTab).toHaveAttribute('aria-expanded', 'false');

    await accountTab.click();
    await expect(sheet).toBeVisible();
    await expect(accountTab).toHaveAttribute('aria-expanded', 'true');
    expect(await sheet.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(accountTab).toHaveAttribute('aria-expanded', 'false');
    await expect(accountTab).toBeFocused();

    await accountTab.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(195, 10); // the backdrop above the sheet
    await expect(sheet).toBeHidden();

    // 6. Language: Bulgarian everywhere, kept after a reload.
    await accountTab.click();
    await choose(sheet, t('common.language'), 'БГ');
    // The sheet's own title is now Bulgarian, so find it by role alone.
    await expect(page.getByRole('dialog').getByRole('radio', { name: 'Български' })).toBeChecked();
    await expect(page.getByRole('dialog', { name: tBg('nav.account') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: tBg('nav.mainLabel') }).getByRole('link', { name: tBg('nav.stats') })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
    await expect(page.getByRole('navigation', { name: tBg('nav.mainLabel') }).getByRole('link', { name: tBg('nav.stats') })).toBeVisible();
    await page.getByRole('button', { name: tBg('nav.account') }).click();
    await choose(page.getByRole('dialog'), tBg('common.language'), 'EN');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // 7. Theme: dark, kept after a reload.
    await choose(sheet, t('common.theme.label'), t('common.theme.dark'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // 8. Log out from the sheet.
    await accountTab.click();
    await sheet.getByRole('button', { name: t('common.logOut') }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await storedToken(page)).toBeNull();
  });

  test('on a staff phone, the More sheet closes when a page is picked', { tag: '@mobile' }, async ({ page, api, signInAs }) => {
    await signInAs('ADMIN');
    mockStaffHome(api);
    api.on('GET', '/api/plans', { body: [plan('p-ten', 'Ten visits')] });

    await page.goto('/home');
    await tabs(page).getByRole('button', { name: t('nav.more') }).click();
    const sheet = page.getByRole('dialog', { name: t('nav.more') });
    await sheet.getByRole('navigation', { name: t('nav.morePages') }).getByRole('link', { name: t('nav.plans') }).click();

    await expect(page).toHaveURL(/\/plans$/);
    await expect(sheet).toBeHidden();
    await expect(shown(page, 'Ten visits')).toBeVisible();
    // The More tab is styled as current here, but only with a CSS class: there is no aria-current or
    // other accessible state to assert. CHARACTERIZATION: possibly unintended — TEST_NOTES.md S17.
  });

  test('a token without a trainee profile shows empty lists and loads nothing', { tag: '@mobile' }, async ({ page, api, signInAs }) => {
    await signInAs('TRAINEE', { traineeProfileId: null });

    await page.goto('/my-profile');

    // CHARACTERIZATION: possibly unintended — the missing-profile message never renders; the trainee
    // reads "no subscriptions" instead. TEST_NOTES.md S16.
    await expect(page.getByText(t('traineeDashboard.noActiveSubscriptions'))).toBeVisible();
    await expect(page.getByText(t('traineeDashboard.missingProfile'))).toHaveCount(0);
    expect(api.requests.filter(request => request.path !== '/api/health')).toEqual([]);
  });

  test('on desktop, the sidebar offers only the trainee pages', { tag: '@desktop' }, async ({ page, api, signInAs }) => {
    await signInAs('TRAINEE');
    mockTraineeData(api);

    await page.goto('/my-profile');
    const nav = page.getByRole('navigation', { name: t('nav.mainLabel') });
    await expect(nav.getByRole('link')).toHaveText([t('nav.profile'), t('nav.stats'), t('nav.records')]);
  });
});
