import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

/** An exercise as a workout lists it. */
export interface WorkoutExercise {
  id: string;
  name: string;
  videoUrl: string | null;
  /** Inactive exercises aren't offered for new workouts, but stay on old ones. */
  isActive: boolean;
}

/**
 * A workout of the day (theindex-api `workouts`, ADMIN and TRAINER; trainees don't see workouts
 * yet). Several may share a day; only their name tells them apart.
 */
export interface Workout {
  id: string;
  /** The gym-local day, YYYY-MM-DD. */
  date: string;
  title: string | null;
  /** Plain text; line breaks matter. */
  summary: string;
  /** The exercises it uses, in order. */
  exercises: WorkoutExercise[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutPayload {
  date: string;
  title: string | null;
  /** Required: up to 3000 characters. */
  summary: string;
  /** In order, each once; may be empty. */
  exerciseIds: string[];
}

/** A movement read from a PDF: matched to an exercise, or not (`exerciseId` null). */
export interface WorkoutDraftExercise {
  /** As the PDF wrote it (singular): the name of a new exercise, or another name of one. */
  name: string;
  exerciseId: string | null;
  exerciseName: string | null;
}

/** What `importPdf` reads from a lesson plan (its RX column). Nothing is saved. */
export interface WorkoutDraft {
  sourceCode: string | null;
  date: string | null;
  title: string | null;
  /** The RX column as printed; empty when it couldn't be read. */
  summary: string;
  exercises: WorkoutDraftExercise[];
  /** What the import could not read, in English. */
  warnings: string[];
}

@Injectable({
  providedIn: 'root',
})
export class WorkoutsService {
  private readonly baseUrl = `${environment.apiUrl}/workouts`;

  constructor(private readonly http: HttpClient) {}

  /** The days from `from` to `to` (YYYY-MM-DD), oldest first. */
  list(range: { from?: string; to?: string } = {}): Observable<Workout[]> {
    return this.http.get<Workout[]>(this.baseUrl, {
      params: buildHttpParams({ from: range.from, to: range.to }),
    });
  }

  getById(id: string): Observable<Workout> {
    return this.http.get<Workout>(`${this.baseUrl}/${id}`);
  }

  create(payload: WorkoutPayload): Observable<Workout> {
    return this.http.post<Workout>(this.baseUrl, payload);
  }

  /** `exerciseIds` replaces the list. */
  update(id: string, payload: WorkoutPayload): Observable<Workout> {
    return this.http.patch<Workout>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  /** Reads the RX workout at the top of a lesson-plan PDF into a draft for the form. */
  importPdf(file: File): Observable<WorkoutDraft> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<WorkoutDraft>(`${this.baseUrl}/import-pdf`, body);
  }
}
