import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';

/** How a result is recorded and ranked (theindex-api `ScoreType`). */
export type ScoreType =
  'TIME' | 'ROUNDS_REPS' | 'REPS' | 'LOAD' | 'CALORIES' | 'DISTANCE' | 'NONE';

export const SCORE_TYPES: ScoreType[] = [
  'TIME',
  'ROUNDS_REPS',
  'REPS',
  'LOAD',
  'CALORIES',
  'DISTANCE',
  'NONE',
];

/** The built-in types, which always exist and can't be deleted. */
export type WorkoutTypeCode =
  'FOR_TIME' | 'AMRAP' | 'EMOM' | 'TABATA' | 'FOR_LOAD' | 'QUALITY';

/**
 * A kind of workout (theindex-api `workout-types`, ADMIN and TRAINER). `code` is set on the
 * built-in ones only. `scoreType` is the score a workout of this type starts with.
 */
export interface WorkoutType {
  id: string;
  name: string;
  description: string | null;
  code: WorkoutTypeCode | null;
  scoreType: ScoreType;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkoutTypePayload {
  name: string;
  description?: string;
  scoreType?: ScoreType;
}

/** An empty description removes it. */
export type UpdateWorkoutTypePayload = Partial<CreateWorkoutTypePayload>;

@Injectable({
  providedIn: 'root',
})
export class WorkoutTypesService {
  private readonly baseUrl = `${environment.apiUrl}/workout-types`;

  constructor(private readonly http: HttpClient) {}

  /** Built-in types first, then the trainers' own by name. */
  list(): Observable<WorkoutType[]> {
    return this.http.get<WorkoutType[]>(this.baseUrl);
  }

  getById(id: string): Observable<WorkoutType> {
    return this.http.get<WorkoutType>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateWorkoutTypePayload): Observable<WorkoutType> {
    return this.http.post<WorkoutType>(this.baseUrl, payload);
  }

  update(
    id: string,
    payload: UpdateWorkoutTypePayload,
  ): Observable<WorkoutType> {
    return this.http.patch<WorkoutType>(`${this.baseUrl}/${id}`, payload);
  }

  /** The API refuses (409) a built-in type and a type a workout uses. */
  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
