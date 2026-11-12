import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

/**
 * A movement workouts list (theindex-api `exercises`, ADMIN and TRAINER). `aliases`
 * are other spellings the PDF import recognises; no two exercises may share a spelling (409).
 * The starter library has the crossfit.com movements, each with its YouTube video.
 */
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  isActive: boolean;
  /** Written by the trainers; the starter library leaves it empty. */
  description: string | null;
  /** https://www.youtube.com/watch?v=<id>; the API stores every link in this form. */
  videoUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateExercisePayload {
  name: string;
  aliases?: string[];
  isActive?: boolean;
  /** Empty or null removes it. */
  description?: string | null;
  /** A YouTube link in any common form; empty or null removes it. */
  videoUrl?: string | null;
}

export type UpdateExercisePayload = Partial<CreateExercisePayload>;

@Injectable({
  providedIn: 'root',
})
export class ExercisesService {
  private readonly baseUrl = `${environment.apiUrl}/exercises`;

  constructor(private readonly http: HttpClient) {}

  /** By name. `active` keeps only active (true) or inactive (false) ones. */
  list(filters: { active?: boolean; q?: string } = {}): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.baseUrl, {
      params: buildHttpParams({ active: filters.active, q: filters.q }),
    });
  }

  getById(id: string): Observable<Exercise> {
    return this.http.get<Exercise>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateExercisePayload): Observable<Exercise> {
    return this.http.post<Exercise>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateExercisePayload): Observable<Exercise> {
    return this.http.patch<Exercise>(`${this.baseUrl}/${id}`, payload);
  }

  /**
   * Adds another spelling (e.g. a lesson plan's) to the exercise's other names, so the next PDF
   * import finds it. One it already answers to changes nothing; another exercise's is 409.
   */
  addAlias(id: string, alias: string): Observable<Exercise> {
    return this.http.post<Exercise>(`${this.baseUrl}/${id}/aliases`, { alias });
  }

  /** Permanent; the API refuses (409) while a workout uses the exercise. */
  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }
}
