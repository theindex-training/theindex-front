import { ApiMock } from './api-mock';

/** Response fixtures shaped like theindex-api DTOs (see src/app/services/*.service.ts). */

export const inactiveTrainee = {
  traineeId: 't-ivan',
  name: 'Ivan Petrov',
  nickname: 'Vanko',
  lastTrainingDate: '2026-10-20T16:30:00Z',
  activeSubscription: {
    planName: '10 visits',
    type: 'PUNCH',
    startDate: '2026-10-01',
    endDate: null,
    remainingTrainings: 4,
    remainingDays: null
  }
};

/** The two reports the staff dashboard (/home) loads. */
export function mockStaffHome(api: ApiMock, inactive: object[] = [inactiveTrainee], withoutSubscription: object[] = []): void {
  api.on('GET', '/api/attendance/reports/inactive-trainees', { body: inactive });
  api.on('GET', '/api/attendance/reports/without-active-subscription', { body: withoutSubscription });
}

/** The three lists the trainee dashboard (/my-profile) loads for profile `traineeId`. */
export function mockTraineeHome(api: ApiMock, traineeId = 'trainee-1'): void {
  api.on('GET', `/api/attendance/trainees/${traineeId}`, { body: [] });
  api.on('GET', `/api/trainees/${traineeId}/subscriptions`, { body: [] });
  api.on('GET', '/api/plans', { body: [] });
}
