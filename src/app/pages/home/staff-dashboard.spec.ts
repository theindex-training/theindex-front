import { DayTraining } from '../../services/schedules.service';
import { Settlement } from '../../services/settlements.service';
import {
  TRAINING_SCOPE_KEY,
  canRegister,
  dashboardDays,
  initialScope,
  registerQuery,
  rememberScope,
  settlementToFinalize,
  trainingStatus,
} from './staff-dashboard';

function dayTraining(over: Partial<DayTraining> = {}): DayTraining {
  return {
    id: 'slot-1',
    date: '2026-11-21',
    weekday: 6,
    trainingTime: { id: 'tt-18', startTime: '18:00:00', endTime: '19:00:00' },
    trainer: {
      id: 'trainer-v',
      name: 'Velcho',
      nickname: null,
      isActive: true,
    },
    workout: null,
    bookedCount: 0,
    gym: { id: 'gym-c', name: 'Center' },
    weekStart: '2026-11-16',
    weekStatus: 'PUBLISHED',
    // 18:00 in Sofia (UTC+2).
    startsAt: '2026-11-21T16:00:00.000Z',
    endsAt: '2026-11-21T17:00:00.000Z',
    attendanceCount: 0,
    unregisteredTraineeIds: [],
    ...over,
  };
}

function settlement(over: Partial<Settlement>): Settlement {
  return {
    id: 's',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-15',
    generatedAt: '2026-11-16T02:00:00Z',
    status: 'DRAFT',
    finalizedAt: null,
    notes: null,
    ...over,
  };
}

describe('trainingStatus', () => {
  const training = dayTraining();

  it('is upcoming until the training starts, then not registered', () => {
    expect(trainingStatus(training, new Date('2026-11-21T15:59:59Z'))).toBe(
      'UPCOMING',
    );
    expect(trainingStatus(training, new Date('2026-11-21T16:00:00Z'))).toBe(
      'UNREGISTERED',
    );
  });

  it('is registered once any attendance is saved for it, even before the start', () => {
    const registered = dayTraining({ attendanceCount: 1 });
    expect(trainingStatus(registered, new Date('2026-11-21T10:00:00Z'))).toBe(
      'REGISTERED',
    );
    expect(trainingStatus(registered, new Date('2026-11-22T10:00:00Z'))).toBe(
      'REGISTERED',
    );
  });
});

describe('canRegister', () => {
  it("allows registering from the training's day on, not ahead of it", () => {
    const training = dayTraining({ date: '2026-11-22' });
    expect(canRegister(training, '2026-11-21')).toBe(false);
    expect(canRegister(training, '2026-11-22')).toBe(true);
    expect(canRegister(training, '2026-11-23')).toBe(true);
  });
});

describe('registerQuery', () => {
  it('fills Register attendance with the day, start, trainer, gym and the booked trainees to tick', () => {
    expect(
      registerQuery(
        dayTraining({ unregisteredTraineeIds: ['t-ana', 't-boris'] }),
      ),
    ).toEqual({
      date: '2026-11-21',
      time: '18:00',
      trainer: 'trainer-v',
      gym: 'gym-c',
      trainees: 't-ana,t-boris',
    });
  });

  it('leaves the trainees out when nobody is left to tick', () => {
    expect(registerQuery(dayTraining())).not.toHaveProperty('trainees');
  });
});

describe('dashboardDays', () => {
  const trainings = [
    dayTraining({ id: 'today-v' }),
    dayTraining({
      id: 'today-a',
      trainer: {
        id: 'trainer-a',
        name: 'Asen',
        nickname: null,
        isActive: true,
      },
    }),
    dayTraining({ id: 'tomorrow-v', date: '2026-11-22' }),
  ];
  const ids = (days: ReturnType<typeof dashboardDays>) =>
    days.map((day) => [day.date, day.label, day.trainings.map((t) => t.id)]);

  it('lists today and tomorrow, each with its trainings in the given order', () => {
    expect(
      ids(dashboardDays(trainings, '2026-11-21', '2026-11-22', 'all', null)),
    ).toEqual([
      ['2026-11-21', 'dashboard.trainings.today', ['today-v', 'today-a']],
      ['2026-11-22', 'dashboard.trainings.tomorrow', ['tomorrow-v']],
    ]);
  });

  it("keeps only the trainer's own with 'mine'", () => {
    expect(
      ids(
        dashboardDays(
          trainings,
          '2026-11-21',
          '2026-11-22',
          'mine',
          'trainer-a',
        ),
      ),
    ).toEqual([
      ['2026-11-21', 'dashboard.trainings.today', ['today-a']],
      ['2026-11-22', 'dashboard.trainings.tomorrow', []],
    ]);
  });

  it("shows everyone's with 'mine' but no trainer profile", () => {
    expect(
      dashboardDays(trainings, '2026-11-21', '2026-11-22', 'mine', null)[0]
        .trainings,
    ).toHaveLength(2);
  });
});

describe('initialScope and rememberScope', () => {
  beforeEach(() => localStorage.clear());

  it("starts on the trainer's own trainings, or everyone's without a trainer profile", () => {
    expect(initialScope('trainer-v')).toBe('mine');
    expect(initialScope(null)).toBe('all');
  });

  it('keeps the choice on the device', () => {
    rememberScope('all');
    expect(localStorage.getItem(TRAINING_SCOPE_KEY)).toBe('all');
    expect(initialScope('trainer-v')).toBe('all');

    rememberScope('mine');
    expect(initialScope('trainer-v')).toBe('mine');
  });
});

describe('settlementToFinalize', () => {
  it('names the oldest draft once its period is over', () => {
    const reports = [
      settlement({
        id: 'nov-2',
        periodStart: '2026-11-16',
        periodEnd: '2026-11-30',
      }),
      settlement({ id: 'nov-1' }),
      settlement({
        id: 'oct-2',
        periodStart: '2026-10-16',
        periodEnd: '2026-10-31',
        status: 'FINAL',
      }),
    ];

    expect(settlementToFinalize(reports, '2026-11-21')?.id).toBe('nov-1');
  });

  it('names none while the oldest draft is still running, or without drafts', () => {
    expect(
      settlementToFinalize(
        [settlement({ periodEnd: '2026-11-15' })],
        '2026-11-15',
      ),
    ).toBeNull();
    expect(
      settlementToFinalize([settlement({ status: 'FINAL' })], '2026-12-01'),
    ).toBeNull();
  });
});
