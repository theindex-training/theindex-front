import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

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

export interface ScheduleWeek {
  gym: { id: string; name: string };
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  weekEnd: string;
  /** The first day that can still change (tomorrow, gym-local); earlier days are read-only. */
  editableFrom: string;
  /** null until a trainer or admin creates the week from the gym's template. */
  week: { id: string; createdAt: string } | null;
  slots: ScheduleSlot[];
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

  /** Creates a gym's week from its template; `week` is any day of it. */
  createWeek(gymId: string, week: string): Observable<ScheduleWeek> {
    return this.http.post<ScheduleWeek>(this.weeksUrl, { gymId, week });
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
