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

export const trainer = (id: string, name: string, nickname: string | null = null, isActive = true) => ({
  id,
  name,
  nickname,
  accountId: null,
  isActive
});

export const gym = (id: string, name: string, isActive = true) => ({ id, name, address: null, notes: null, isActive });

export const trainee = (id: string, name: string, nickname: string | null = null, overrides: object = {}) => ({
  id,
  name,
  nickname,
  phone: null,
  accountId: null,
  gymSubscriptionId: null,
  isActive: true,
  ...overrides
});

export const plan = (id: string, title: string, overrides: object = {}) => ({
  id,
  type: 'PUNCH',
  title,
  priceCents: 4550,
  credits: 10,
  durationDays: null,
  isActive: true,
  ...overrides
});

/** An attendance-sessions response (GET /api/attendance/sessions). */
export function sessionsResponse(sessions: object[], entities: { trainees?: object[]; trainers?: object[] } = {}) {
  return {
    filters: { startDate: '', endDate: '', startTime: '', endTime: '', trainerId: null },
    sessions,
    entities: {
      trainees: entities.trainees ?? [],
      trainers: entities.trainers ?? [],
      locations: [{ id: 'gym-1', name: 'Center' }]
    }
  };
}

/** One of a trainee's trainings, as GET /api/attendance/trainees/:id returns it. */
export const trainingItem = (
  id: string,
  trainedAt: string,
  overrides: { paymentStatus?: 'PAID' | 'UNPAID'; trainer?: [string, string | null]; gym?: string; traineeId?: string } = {}
) => {
  const [name, nickname] = overrides.trainer ?? ['Petar Petrov', 'Pepi'];
  return {
    id,
    traineeId: overrides.traineeId ?? 'trainee-1',
    trainerId: `trainer-${name}`,
    trainer: { id: `trainer-${name}`, name, nickname },
    locationId: `gym-${overrides.gym ?? 'Center'}`,
    location: { id: `gym-${overrides.gym ?? 'Center'}`, name: overrides.gym ?? 'Center' },
    trainedAt,
    subscriptionId: null,
    gymSubscriptionId: null,
    paymentStatus: overrides.paymentStatus ?? 'PAID',
    createdAt: trainedAt
  };
};
