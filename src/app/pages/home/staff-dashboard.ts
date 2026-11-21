import { Settlement } from '../../services/settlements.service';
import { DayTraining } from '../../services/schedules.service';
import { formatTimeWithoutSeconds } from '../../utils/time-display';

/** Where a training stands for the person registering attendance. */
export type TrainingStatus = 'UPCOMING' | 'UNREGISTERED' | 'REGISTERED';

/** Whose trainings the dashboard lists: the trainer's own, or every trainer's. */
export type TrainingScope = 'mine' | 'all';

/** The choice is kept on this device (localStorage `dashboardTrainings`). */
export const TRAINING_SCOPE_KEY = 'dashboardTrainings';

export interface DashboardDay {
  date: string;
  /** Translation key: today or tomorrow. */
  label: 'dashboard.trainings.today' | 'dashboard.trainings.tomorrow';
  trainings: DayTraining[];
}

/**
 * Registered once any attendance is saved for it (its gym, at its start), otherwise upcoming until
 * it starts and then not registered.
 */
export function trainingStatus(
  training: DayTraining,
  now: Date,
): TrainingStatus {
  if (training.attendanceCount > 0) {
    return 'REGISTERED';
  }
  return new Date(training.startsAt).getTime() <= now.getTime()
    ? 'UNREGISTERED'
    : 'UPCOMING';
}

/** Attendance is registered from the training's day on, as on the training's page. */
export function canRegister(training: DayTraining, today: string): boolean {
  return training.date <= today;
}

/**
 * Register attendance filled in with the training (`/attendance/new?…`): its day, start, trainer
 * and gym, and the booked trainees who aren't registered yet.
 */
export function registerQuery(training: DayTraining): Record<string, string> {
  return {
    date: training.date,
    time: formatTimeWithoutSeconds(training.trainingTime.startTime),
    trainer: training.trainer.id,
    gym: training.gym.id,
    ...(training.unregisteredTraineeIds.length
      ? { trainees: training.unregisteredTraineeIds.join(',') }
      : {}),
  };
}

/** Today's and tomorrow's trainings, the trainer's own only with `mine` and a trainer profile. */
export function dashboardDays(
  trainings: DayTraining[],
  today: string,
  tomorrow: string,
  scope: TrainingScope,
  trainerId: string | null,
): DashboardDay[] {
  const shown =
    scope === 'mine' && trainerId
      ? trainings.filter((t) => t.trainer.id === trainerId)
      : trainings;
  return [
    { date: today, label: 'dashboard.trainings.today' as const },
    { date: tomorrow, label: 'dashboard.trainings.tomorrow' as const },
  ].map((day) => ({
    ...day,
    trainings: shown.filter((t) => t.date === day.date),
  }));
}

/** The scope a dashboard opens with: the one kept on the device, else the trainer's own. */
export function initialScope(trainerId: string | null): TrainingScope {
  if (!trainerId) {
    return 'all';
  }
  try {
    return localStorage.getItem(TRAINING_SCOPE_KEY) === 'all' ? 'all' : 'mine';
  } catch {
    return 'mine';
  }
}

export function rememberScope(scope: TrainingScope): void {
  try {
    localStorage.setItem(TRAINING_SCOPE_KEY, scope);
  } catch {
    // Storage can be off (private windows); the choice is just not kept.
  }
}

/**
 * The report an admin can finalize now: the oldest draft, once its period is over (the API
 * finalizes drafts oldest first, and none before its period ends).
 */
export function settlementToFinalize(
  settlements: Settlement[],
  today: string,
): Settlement | null {
  const oldestDraft = settlements
    .filter((s) => s.status === 'DRAFT')
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
  return oldestDraft && oldestDraft.periodEnd.slice(0, 10) < today
    ? oldestDraft
    : null;
}
