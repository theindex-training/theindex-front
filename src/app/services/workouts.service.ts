import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';
import { ExerciseMeasure } from './exercises.service';
import { ScoreType, WorkoutTypeCode } from './workout-types.service';

/** The versions of one workout. RX is the workout as prescribed and always exists. */
export type WorkoutLevel = 'RX' | 'INTERMEDIATE' | 'BEGINNER';
export const WORKOUT_LEVELS: WorkoutLevel[] = [
  'RX',
  'INTERMEDIATE',
  'BEGINNER',
];

/**
 * A movement with its amount. `quantity` is in the measure's unit (reps, metres, seconds,
 * calories); it is null when the reps come from the level's rep scheme or the item is a max
 * effort. Loads are kilograms. The `...Female` values are the women's, when they differ.
 */
export interface WorkoutItemFields {
  exerciseId: string;
  measure: ExerciseMeasure;
  quantity: number | null;
  quantityMax: number | null;
  quantityFemale: number | null;
  maxEffort: boolean;
  loadKg: number | null;
  loadFemaleKg: number | null;
  loadPercent: number | null;
  /** In interval workouts, the interval of the rotation ("minute 2"). */
  slot: number | null;
  notes: string | null;
}

/** How one level does the part. Durations are seconds. */
export interface WorkoutVariantFields {
  level: WorkoutLevel;
  rounds: number | null;
  /** Reps per round for the items without their own amount: 21-15-9. */
  repScheme: number[] | null;
  /** AMRAP 12 -> 720; EMOM 20 -> 1200. */
  durationSeconds: number | null;
  timeCapSeconds: number | null;
  /** EMOM -> 60; "every 2:00" -> 120. */
  intervalSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface WorkoutItem extends WorkoutItemFields {
  exercise: { id: string; name: string };
}

export interface WorkoutVariant extends WorkoutVariantFields {
  items: WorkoutItem[];
}

export interface WorkoutPart {
  id: string;
  title: string | null;
  workoutTypeId: string;
  workoutType: { id: string; name: string; code: WorkoutTypeCode | null };
  scoreType: ScoreType;
  variants: WorkoutVariant[];
}

/**
 * The workout of a day (theindex-api `workouts`, ADMIN and TRAINER; trainees don't see workouts
 * yet). Parts are what is done and how it is scored; each has one variant per level.
 */
export interface Workout {
  id: string;
  /** The gym-local day, YYYY-MM-DD. */
  date: string;
  title: string | null;
  notes: string | null;
  parts: WorkoutPart[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkoutPartPayload {
  /** On update: the id of the part this one replaces, so it keeps its identity. */
  id?: string;
  title: string | null;
  workoutTypeId: string;
  scoreType: ScoreType;
  variants: (WorkoutVariantFields & { items: WorkoutItemFields[] })[];
}

export interface WorkoutPayload {
  date: string;
  title: string | null;
  notes: string | null;
  parts: WorkoutPartPayload[];
}

/** An item read from a PDF: `exerciseId` is null when the movement isn't in the catalogue. */
export interface WorkoutDraftItem extends Omit<
  WorkoutItemFields,
  'exerciseId'
> {
  exerciseId: string | null;
  exerciseName: string;
}

export interface WorkoutDraftPart {
  title: string | null;
  typeCode: WorkoutTypeCode;
  workoutTypeId: string | null;
  scoreType: ScoreType;
  variants: (WorkoutVariantFields & { items: WorkoutDraftItem[] })[];
}

/** What `importPdf` reads from a lesson plan. Nothing is saved until the form is submitted. */
export interface WorkoutDraft {
  sourceCode: string | null;
  date: string | null;
  title: string | null;
  parts: WorkoutDraftPart[];
  /** Movements to create before the workout can be saved. */
  unknownExercises: string[];
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

  /** `parts` replaces the whole content. */
  update(id: string, payload: WorkoutPayload): Observable<Workout> {
    return this.http.patch<Workout>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  /** Reads the workout at the top of a lesson-plan PDF into a draft for the form. */
  importPdf(file: File): Observable<WorkoutDraft> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<WorkoutDraft>(`${this.baseUrl}/import-pdf`, body);
  }
}
