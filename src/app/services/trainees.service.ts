import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

export interface TraineeProfile {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  accountId: string | null;
  gymSubscriptionId: string | null;
  /** The gym the trainee usually trains in: the default gym of their pages. */
  preferredGymId?: string | null;
  /** Social network profiles: a handle or a link, as typed. */
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  isActive: boolean;
  createdAt?: string;
  /**
   * Their profile photo's thumbnail, or null (theindex-api gives it on `GET /api/trainees` and
   * `GET /api/trainees/:id`; other answers leave it out).
   */
  photoUrl?: string | null;
}

export interface CreateTraineePayload {
  name: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
  gymSubscriptionId?: string | null;
  preferredGymId?: string | null;
}

/**
 * The trainee's year at the gym (theindex-api `GET /api/trainees/me/year-in-review?year=`), for
 * the New Year story. Days and times are gym-local; nulls and 0 for a year without trainings.
 */
export interface YearInReview {
  year: number;
  trainings: number;
  /** 'YYYY-MM-DD' */
  firstTrainingOn: string | null;
  /** 'HH:mm' */
  favouriteTime: { time: string; count: number } | null;
  /** Weeks (Monday to Sunday) in a row with at least one training. */
  longestStreakWeeks: number;
  topTrainer: {
    id: string;
    name: string;
    count: number;
    photoUrl: string | null;
  } | null;
  /** 1–12 */
  busiestMonth: { month: number; count: number } | null;
}

export interface TraineeTrainingInsights {
  traineeId: string;
  totalAttendances: number;
  topTrainingPartners: {
    traineeId: string;
    traineeName: string;
    trainingsTogether: number;
  }[];
  topTrainers: {
    trainerId: string;
    trainerName: string;
    trainingsCount: number;
  }[];
  topGyms: {
    gymId: string;
    gymName: string;
    trainingsCount: number;
  }[];
  topWeekdays: {
    weekday: string;
    weekdayNumber: number;
    trainingsCount: number;
  }[];
  topTimeSlots: {
    timeSlot: string;
    trainingsCount: number;
  }[];
}

export interface UpdateTraineePayload {
  name?: string;
  nickname?: string | null;
  phone?: string | null;
  isActive?: boolean;
  gymSubscriptionId?: string | null;
  preferredGymId?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TraineesService {
  private readonly baseUrl = `${environment.apiUrl}/trainees`;

  constructor(private readonly http: HttpClient) {}

  list(active?: boolean, search?: string): Observable<TraineeProfile[]> {
    const params = buildHttpParams({
      active,
      search,
    });

    return this.http.get<TraineeProfile[]>(this.baseUrl, { params });
  }

  getById(id: string): Observable<TraineeProfile> {
    return this.http.get<TraineeProfile>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTraineePayload): Observable<TraineeProfile> {
    return this.http.post<TraineeProfile>(this.baseUrl, payload);
  }

  update(
    id: string,
    payload: UpdateTraineePayload,
  ): Observable<TraineeProfile> {
    return this.http.patch<TraineeProfile>(`${this.baseUrl}/${id}`, payload);
  }

  deactivate(id: string): Observable<TraineeProfile> {
    return this.http.delete<TraineeProfile>(`${this.baseUrl}/${id}`);
  }

  getMyTrainingInsights(): Observable<TraineeTrainingInsights> {
    return this.http.get<TraineeTrainingInsights>(
      `${this.baseUrl}/me/training-insights`,
    );
  }

  /** The signed-in trainee's year in review (TRAINEE only). */
  getMyYearInReview(year: number): Observable<YearInReview> {
    return this.http.get<YearInReview>(`${this.baseUrl}/me/year-in-review`, {
      params: buildHttpParams({ year }),
    });
  }
}
