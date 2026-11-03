import { Page } from '@playwright/test';
import { apiError } from '../support/api-mock';
import { gym, mockStaffHome, sessionsResponse, trainee, trainer } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J3: a trainer registers a session's attendance on a phone. */
test.describe('J3 register attendance', () => {
  test.beforeEach(async ({ page, api, signInAs }) => {
    await page.clock.setFixedTime(new Date('2026-11-02T10:00:00+02:00'));
    await signInAs('TRAINER', { trainerProfileId: 'trainer-1' });
    mockStaffHome(api);
    api.on('GET', '/api/trainers', { body: [trainer('trainer-other', 'Maria'), trainer('trainer-1', 'Petar', 'Pepi')] });
    api.on('GET', '/api/gym-locations', { body: [gym('gym-1', 'Center'), gym('gym-2', 'South')] });
    api.on('GET', '/api/training-times', {
      body: [
        { id: 'tt-evening', startTime: '18:00:00', endTime: '19:00:00' },
        { id: 'tt-morning', startTime: '07:30:00', endTime: '08:30:00' }
      ]
    });
    api.on('GET', '/api/trainees', {
      body: [
        trainee('t-ivan', 'Ivan Petrov', 'Vanko'),
        trainee('t-ivelina', 'Ivelina Koleva'),
        trainee('t-georgi', 'Georgi Dimitrov', 'Gosho')
      ]
    });
    api.on('GET', '/api/attendance/sessions', { body: sessionsResponse([]) });
    api.on('POST', '/api/attendance/batch', {
      body: { trainerId: 'trainer-1', trainedAt: '2026-11-02T16:00:00Z', count: 1, results: [] }
    });
  });

  const traineeBox = (page: Page, name: string) => page.getByRole('checkbox', { name: new RegExp(name) });
  const search = (page: Page) => page.getByRole('searchbox', { name: t('attendance.register.searchLabel') });
  const save = (page: Page) => page.getByRole('button', { name: t('attendance.register.submit') });

  async function openFromTabBar(page: Page) {
    await page.goto('/home');
    await page.getByRole('navigation', { name: t('nav.mainLabel') }).getByRole('link', { name: t('nav.register') }).click();
    await expect(page).toHaveURL(/\/attendance\/new$/);
  }

  test('registers trainees for a session from the phone tab bar', { tag: '@mobile' }, async ({ page, api }) => {
    await openFromTabBar(page);

    await expect.poll(() => api.last('GET', '/api/trainers')?.query).toEqual({ active: 'true' });
    await expect.poll(() => api.last('GET', '/api/gym-locations')?.query).toEqual({ includeInactive: 'false' });
    await expect.poll(() => api.last('GET', '/api/trainees')?.query).toEqual({ active: 'true' });
    await expect(page.getByLabel(t('attendance.register.trainer'))).toHaveValue('trainer-1');
    await expect(page.getByLabel(t('attendance.register.gym'))).toHaveValue('gym-1');
    await expect(page.getByLabel(t('attendance.register.date'))).toHaveValue('2026-11-02');
    const times = page.getByLabel(t('attendance.register.time')).getByRole('option');
    await expect(times).toHaveText([t('attendance.register.notSpecified'), '07:30 - 08:30', '18:00 - 19:00']);

    await save(page).click();
    await expect(page.getByRole('alert')).toHaveText(t('attendance.register.selectAtLeastOne'));
    expect(api.calls('POST', '/api/attendance/batch')).toHaveLength(0);

    await search(page).fill('iv');
    await expect(page.getByRole('checkbox')).toHaveCount(2);
    await traineeBox(page, 'Ivan Petrov').check();
    await traineeBox(page, 'Ivelina Koleva').check();
    await search(page).fill('');
    await expect(traineeBox(page, 'Ivan Petrov')).toBeChecked();
    await traineeBox(page, 'Georgi Dimitrov').check();

    await search(page).fill('ivelina');
    await page.getByRole('button', { name: t('attendance.register.clearShown') }).click();
    await search(page).fill('');
    await expect(traineeBox(page, 'Ivelina Koleva')).not.toBeChecked();
    await expect(traineeBox(page, 'Ivan Petrov')).toBeChecked();

    await page.getByLabel(t('attendance.register.time')).selectOption('18:00');
    await save(page).click();

    await expect(page).toHaveURL(/\/attendance$/);
    await expect.poll(() => api.last('POST', '/api/attendance/batch')?.body).toEqual({
      trainerId: 'trainer-1',
      locationId: 'gym-1',
      traineeIds: ['t-ivan', 't-georgi'],
      trainedDate: '2026-11-02',
      trainedTime: '18:00'
    });
    await expect.poll(() => api.last('GET', '/api/attendance/sessions')?.query).toEqual({
      startDate: '2026-10-26',
      endDate: '2026-11-02',
      trainerId: 'trainer-1'
    });
  });

  test('keeps the selection and shows the API errors when saving fails', { tag: '@mobile' }, async ({ page, api }) => {
    api.on('POST', '/api/attendance/batch', apiError(400, ['trainedDate must not be in the future', 'trainee is inactive']));
    await openFromTabBar(page);

    await traineeBox(page, 'Ivan Petrov').check();
    await save(page).click();

    await expect(page.getByRole('alert')).toHaveText('trainedDate must not be in the future, trainee is inactive');
    await expect(page).toHaveURL(/\/attendance\/new$/);
    await expect(traineeBox(page, 'Ivan Petrov')).toBeChecked();
  });

  test('works the same from the desktop sidebar', { tag: '@desktop' }, async ({ page, api }) => {
    await openFromTabBar(page);
    await traineeBox(page, 'Georgi Dimitrov').check();
    await save(page).click();

    await expect(page).toHaveURL(/\/attendance$/);
    await expect.poll(() => api.last('POST', '/api/attendance/batch')?.body).toEqual({
      trainerId: 'trainer-1',
      locationId: 'gym-1',
      traineeIds: ['t-georgi'],
      trainedDate: '2026-11-02'
    });
  });
});
