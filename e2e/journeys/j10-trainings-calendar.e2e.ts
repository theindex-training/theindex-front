import { Locator, Page } from '@playwright/test';
import { ApiMock } from '../support/api-mock';
import { trainingItem } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J10: a trainee browses their trainings in the calendar and switches to the list. */
const TRAININGS = [
  trainingItem('a1', '2026-10-07T04:00:00Z'),
  trainingItem('a2', '2026-10-07T15:30:00Z', { paymentStatus: 'UNPAID', trainer: ['Maria Koleva', null], gym: 'Lozenets' }),
  trainingItem('a3', '2026-10-30T15:30:00Z'),
  trainingItem('a4', '2026-11-02T16:30:00Z')
];

function mockTrainee(api: ApiMock) {
  api.on('GET', '/api/attendance/trainees/trainee-1', { body: TRAININGS });
  api.on('GET', '/api/trainees/trainee-1/subscriptions', { body: [] });
  api.on('GET', '/api/plans', { body: [] });
}

/** Tuesday 3 Nov 2026, midday in Sofia. Only the clock is fixed; timers run. */
async function freezeToday(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+02:00'));
}

const trainingsSection = (page: Page) => page.getByRole('region', { name: t('traineeDashboard.trainings'), exact: true });
const viewSwitch = (scope: Locator) => scope.getByRole('group', { name: t('trainings.view.label') });
const day = (scope: Locator, date: string, count: number, unpaid = 0) =>
  scope.getByRole('button', { name: t('trainings.calendar.dayLabel', { date, count, unpaid }), exact: true });

test.describe('J10 trainings calendar', () => {
  test('a trainee pages through months, opens a day and switches to the list', { tag: '@desktop' }, async ({ page, api, signInAs }) => {
    await freezeToday(page);
    await signInAs('TRAINEE');
    mockTrainee(api);

    // 1. The calendar is the default view, on the current month, with today marked.
    await page.goto('/my-profile');
    const section = trainingsSection(page);
    await expect(section.getByRole('radio', { name: t('trainings.view.calendar') })).toBeChecked();
    await expect(section.getByTestId('calendar-month')).toHaveText('November 2026');
    await expect(section.getByTestId('calendar-summary')).toHaveText(
      t('trainings.calendar.summary', { count: 1, paid: 1, unpaid: 0 })
    );
    await expect(day(section, 'Tuesday, 3 November 2026', 0)).toHaveAttribute('aria-current', 'date');
    await expect(day(section, 'Monday, 2 November 2026', 1)).toContainText('Pepi');
    await expect(section.getByRole('button', { name: t('trainings.calendar.today') })).toBeDisabled();
    await expect(section.getByRole('list', { name: t('trainings.calendar.legend') })).toContainText(
      t('trainings.calendar.legendUnpaid')
    );

    // 2. Back a month: each cell shows time, trainer and gym.
    await section.getByRole('button', { name: t('trainings.calendar.previousMonth') }).click();
    await expect(section.getByTestId('calendar-month')).toHaveText('October 2026');
    await expect(section.getByTestId('calendar-summary')).toHaveText(
      t('trainings.calendar.summary', { count: 3, paid: 2, unpaid: 1 })
    );
    const busyDay = day(section, 'Wednesday, 7 October 2026', 2, 1);
    await expect(busyDay).toContainText('07:00 Pepi');
    await expect(busyDay).toContainText('18:30 Maria Koleva');
    await expect(busyDay).toContainText('Lozenets');

    // 3. Opening a day lists its trainings with their payment status.
    await busyDay.click();
    await expect(busyDay).toHaveAttribute('aria-pressed', 'true');
    const panel = section.getByTestId('calendar-panel');
    await expect(panel.getByRole('heading', { name: 'Wednesday, 7 October 2026' })).toBeVisible();
    await expect(panel.getByRole('listitem')).toHaveCount(2);
    await expect(panel.getByRole('listitem').nth(1)).toContainText(t('enums.paymentStatus.UNPAID'));
    await panel.getByRole('button', { name: t('trainings.calendar.clearSelection') }).click();
    await expect(busyDay).toHaveAttribute('aria-pressed', 'false');

    // 4. Keyboard: the grid is one tab stop; arrows move between days, across months.
    await busyDay.focus();
    await page.keyboard.press('ArrowDown');
    await expect(day(section, 'Wednesday, 14 October 2026', 0)).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect(section.getByTestId('calendar-month')).toHaveText('November 2026');
    await expect(day(section, 'Saturday, 14 November 2026', 0)).toBeFocused();

    // 5. Forward is allowed (nothing there yet); Today comes back.
    await section.getByRole('button', { name: t('trainings.calendar.nextMonth') }).click();
    await expect(section.getByTestId('calendar-month')).toHaveText('December 2026');
    await expect(section.getByTestId('calendar-summary')).toHaveText(t('trainings.calendar.noneThisMonth'));
    await section.getByRole('button', { name: t('trainings.calendar.today') }).click();
    await expect(section.getByTestId('calendar-month')).toHaveText('November 2026');

    // 6. The list shows every training; the choice is remembered after a reload.
    await viewSwitch(section).getByText(t('trainings.view.list'), { exact: true }).click();
    await expect(section.getByRole('radio', { name: t('trainings.view.list') })).toBeChecked();
    const table = section.getByRole('region', { name: t('trainings.tableLabel') });
    await expect(table.getByRole('row')).toHaveCount(TRAININGS.length + 1);
    await page.reload();
    await expect(trainingsSection(page).getByRole('radio', { name: t('trainings.view.list') })).toBeChecked();
    await expect(trainingsSection(page).getByRole('region', { name: t('trainings.tableLabel') })).toBeVisible();

    // 7. And back to the calendar.
    await viewSwitch(trainingsSection(page)).getByText(t('trainings.view.calendar'), { exact: true }).click();
    await expect(trainingsSection(page).getByTestId('calendar-month')).toHaveText('November 2026');
  });

  test('on a phone, days show markers and the month is listed below the grid', { tag: '@mobile' }, async ({ page, api, signInAs }) => {
    await freezeToday(page);
    await signInAs('TRAINEE');
    mockTrainee(api);

    await page.goto('/my-profile');
    const section = trainingsSection(page);
    await section.getByRole('button', { name: t('trainings.calendar.previousMonth') }).click();
    await expect(section.getByTestId('calendar-month')).toHaveText('October 2026');

    // Cells are too narrow for text: the trainer names appear only in the list below the grid.
    const busyDay = day(section, 'Wednesday, 7 October 2026', 2, 1);
    await expect(busyDay.getByText('Pepi')).toBeHidden();
    const panel = section.getByTestId('calendar-panel');
    await expect(panel.getByRole('heading', { name: t('trainings.calendar.monthList', { month: 'October 2026' }) })).toBeVisible();
    await expect(panel.getByRole('listitem')).toHaveCount(3);

    // Tapping a day narrows the list to it.
    await day(section, 'Friday, 30 October 2026', 1).click();
    await expect(panel.getByRole('heading', { name: 'Friday, 30 October 2026' })).toBeVisible();
    await expect(panel.getByRole('listitem')).toHaveCount(1);
    await expect(panel.getByRole('listitem')).toContainText('Pepi · Center');

    // The day list stays reachable above the tab bar.
    await panel.getByRole('listitem').scrollIntoViewIfNeeded();
    await expect(panel.getByRole('listitem')).toBeInViewport();
  });
});
