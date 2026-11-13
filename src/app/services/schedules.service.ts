import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';
import { TrainingWorkout } from './bookings.service';

/** A training time as a schedule slot gives it (Postgres `time`, e.g. '07:10:00'). */
export interface ScheduleTrainingTime {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleTrainer {
  id: string;
  name: string;
  nickname: string | null;
  /** An inactive trainer stays on the slots they had. */
  isActive: boolean;
}

/** One training of a gym's usual week (theindex-api `schedule_template_slots`). */
export interface TemplateSlot {
  id: string;
  /** 1 = Monday ... 7 = Sunday. */
  weekday: number;
  trainingTime: ScheduleTrainingTime;
  trainer: ScheduleTrainer;
}

export interface ScheduleTemplate {
  gym: { id: string; name: string };
  /** By weekday, start, end and trainer name (the API's order). */
  slots: TemplateSlot[];
}

/** One training of a gym's real week (theindex-api `schedule_slots`). */
export interface ScheduleSlot {
  id: string;
  /** The gym-local day, YYYY-MM-DD. */
  date: string;
  weekday: number;
  trainingTime: ScheduleTrainingTime;
  trainer: ScheduleTrainer;
  /** A workout of the same day, when the trainer chose one. */
  workout: { id: string; title: string | null } | null;
  /** Trainees who booked it (a plan to come, not attendance). */
  bookedCount: number;
}

/**
 * A week created from the template is a DRAFT only staff see; once PUBLISHED, trainees see it and
 * can book its trainings (for good: a published week can't go back to draft).
 */
export type ScheduleWeekStatus = 'DRAFT' | 'PUBLISHED';

export interface ScheduleWeek {
  gym: { id: string; name: string };
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  weekEnd: string;
  /** The first day that can still change (tomorrow, gym-local); earlier days are read-only. */
  editableFrom: string;
  /** null until a trainer or admin creates the week from the gym's template. */
  week: {
    id: string;
    createdAt: string;
    status: ScheduleWeekStatus;
    /** null for a draft (and for weeks published before drafts existed). */
    publishedAt: string | null;
  } | null;
  slots: ScheduleSlot[];
}

/** How close a booked trainee is to the end of what they paid for (the attendance preview's). */
export type TrainingBookingLevel = 'UNPAID' | 'LAST' | 'LOW' | 'OK';

/**
 * A trainee who booked a training, with what is left of their subscriptions. Until attendance is
 * saved for the training (`attendanceSaved: false`) the figures are projected: what would be left
 * if they come and attendance is saved for it. Once saved, they are what is left now.
 */
export interface TrainingBookingRow {
  traineeId: string;
  name: string;
  nickname: string | null;
  isActive: boolean;
  bookedAt: string;
  attendanceSaved: boolean;
  paymentStatus: 'PAID' | 'UNPAID';
  level: TrainingBookingLevel;
  /** The subscription that pays (or would pay); null when unpaid. */
  subscription: {
    type: 'PUNCH' | 'TIME';
    planTitle: string;
    /** PUNCH: trainings left over all active punch subscriptions. */
    remainingCredits: number | null;
    /** TIME: when the paid period ends, and the days from today until then. */
    endsAt: string | null;
    daysLeft: number | null;
  } | null;
}

/** `GET /api/schedules/slots/:id`: one training for staff, with who booked it. */
export interface ScheduleTraining extends Omit<ScheduleSlot, 'workout'> {
  /** The whole workout, as trainees see it on their training page; null when none is chosen. */
  workout: (TrainingWorkout & { id: string }) | null;
  gym: { id: string; name: string };
  /** Monday of the training's week, YYYY-MM-DD. */
  weekStart: string;
  startsAt: string;
  /** Needing attention first (unpaid, last, low), then by name: the API's order. */
  trainees: TrainingBookingRow[];
}

/**
 * A slot's training time: an existing one by id, or hours the API matches to an existing
 * training time or creates one for.
 */
export type SlotTrainingTimePayload =
  | { trainingTimeId: string }
  | { trainingTime: { startTime: string; endTime: string } };

/** The fields a PATCH changes; the others stay as they are. */
export interface SlotChanges {
  trainingTimeId?: string;
  trainingTime?: { startTime: string; endTime: string };
  trainerId?: string;
  weekday?: number;
  /** Week slots only; null removes it. */
  workoutId?: string | null;
}

export type TemplateSlotPayload = SlotTrainingTimePayload & {
  weekday: number;
  trainerId: string;
};

export type ScheduleSlotPayload = SlotTrainingTimePayload & {
  trainerId: string;
  /** null for none (on an update, null removes it). */
  workoutId: string | null;
};

/**
 * Gym schedule templates (ADMIN changes them, TRAINER reads them) and the real weeks created from
 * them (ADMIN and TRAINER).
 */
@Injectable({
  providedIn: 'root',
})
export class SchedulesService {
  private readonly templatesUrl = `${environment.apiUrl}/schedule-templates`;
  private readonly weeksUrl = `${environment.apiUrl}/schedules`;

  constructor(private readonly http: HttpClient) {}

  template(gymId: string): Observable<ScheduleTemplate> {
    return this.http.get<ScheduleTemplate>(`${this.templatesUrl}/${gymId}`);
  }

  addTemplateSlot(
    gymId: string,
    payload: TemplateSlotPayload,
  ): Observable<TemplateSlot> {
    return this.http.post<TemplateSlot>(
      `${this.templatesUrl}/${gymId}/slots`,
      payload,
    );
  }

  updateTemplateSlot(
    id: string,
    payload: SlotChanges,
  ): Observable<TemplateSlot> {
    return this.http.patch<TemplateSlot>(
      `${this.templatesUrl}/slots/${id}`,
      payload,
    );
  }

  deleteTemplateSlot(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.templatesUrl}/slots/${id}`,
    );
  }

  /** A gym's week; `week` is any day of it. */
  week(gymId: string, week: string): Observable<ScheduleWeek> {
    const params = buildHttpParams({ gymId, week });
    return this.http.get<ScheduleWeek>(this.weeksUrl, { params });
  }

  /** Creates a gym's week from its template as a draft; `week` is any day of it. */
  createWeek(gymId: string, week: string): Observable<ScheduleWeek> {
    return this.http.post<ScheduleWeek>(this.weeksUrl, { gymId, week });
  }

  /** Shows a draft week to trainees and opens its booking; answers the week. */
  publishWeek(weekId: string): Observable<ScheduleWeek> {
    return this.http.post<ScheduleWeek>(
      `${this.weeksUrl}/${weekId}/publish`,
      {},
    );
  }

  /** Discards a draft week with its trainings (the API refuses a published one). */
  discardWeek(weekId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.weeksUrl}/${weekId}`);
  }

  addSlot(
    weekId: string,
    payload: ScheduleSlotPayload & { date: string },
  ): Observable<ScheduleSlot> {
    return this.http.post<ScheduleSlot>(
      `${this.weeksUrl}/${weekId}/slots`,
      payload,
    );
  }

  /** One training with the trainees who booked it and what they have left. */
  training(id: string): Observable<ScheduleTraining> {
    return this.http.get<ScheduleTraining>(`${this.weeksUrl}/slots/${id}`);
  }

  updateSlot(id: string, payload: SlotChanges): Observable<ScheduleSlot> {
    return this.http.patch<ScheduleSlot>(
      `${this.weeksUrl}/slots/${id}`,
      payload,
    );
  }

  deleteSlot(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.weeksUrl}/slots/${id}`,
    );
  }
}
