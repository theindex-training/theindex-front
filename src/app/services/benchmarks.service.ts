import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { Observable } from 'rxjs';
import { buildHttpParams } from '../utils/http-params.util';

/**
 * Benchmarks and heavy lifts, their results and leaderboards (theindex-api `benchmarks`).
 * - A benchmark (Fran, Murph, Cindy...) has a description and one or more exercises; results are
 *   Rx or scaled. A heavy lift is one exercise, one rep, the heaviest load, never scaled.
 * - Everyone reads the catalogue and the leaderboards; ADMIN and TRAINER change the catalogue.
 * - Trainees and trainers log their own results (the profile comes from the token); the owner
 *   changes or deletes them, an admin deletes any.
 */
export type BenchmarkKind = 'BENCHMARK' | 'LIFT';
/** TIME (lower is better, optional time cap), ROUNDS_REPS (AMRAP), REPS; LOAD for lifts only. */
export type BenchmarkScoreType = 'TIME' | 'ROUNDS_REPS' | 'REPS' | 'LOAD';

export interface BenchmarkExercise {
  id: string;
  name: string;
  /** Written by the trainers; may be empty. */
  description: string | null;
  videoUrl: string | null;
  isActive: boolean;
}

export interface Benchmark {
  id: string;
  kind: BenchmarkKind;
  name: string;
  scoreType: BenchmarkScoreType;
  /** TIME only: whoever doesn't finish within it logs the reps done. */
  timeCapSeconds: number | null;
  /** Plain text; its line breaks matter. Empty for most heavy lifts. */
  description: string;
  /** In order; a heavy lift has exactly one. */
  exercises: BenchmarkExercise[];
  isActive: boolean;
  /** Results logged on it: with any, it can't be deleted or change its score type. */
  resultCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBenchmarkPayload {
  kind: BenchmarkKind;
  name: string;
  /** Required for a benchmark; a heavy lift is always LOAD. */
  scoreType?: BenchmarkScoreType;
  timeCapSeconds?: number | null;
  description?: string;
  exerciseIds: string[];
  isActive?: boolean;
}

/** Everything but the kind; `exerciseIds`, when sent, replaces the list. */
export type UpdateBenchmarkPayload = Partial<
  Omit<CreateBenchmarkPayload, 'kind'>
>;

/** A result's score: only the fields of its benchmark's score type are set. */
export interface Score {
  timeSeconds: number | null;
  /** TIME: not finished within the time cap; `reps` are the reps done. */
  capped: boolean;
  rounds: number | null;
  reps: number | null;
  loadKg: number | null;
}

/** A leaderboard row: one person's best result. */
export interface LeaderboardEntry extends Score {
  /** Equal scores share a rank. */
  rank: number;
  resultId: string;
  name: string;
  /** Their profile photo's thumbnail, or null (initials show instead). */
  photoUrl: string | null;
  personType: 'TRAINEE' | 'TRAINER';
  /** The signed-in person's own row. */
  isMe: boolean;
  /** 'YYYY-MM-DD', the day it was done. */
  performedOn: string;
  note: string | null;
}

export interface Leaderboard {
  rx: LeaderboardEntry[];
  /** Always empty for a heavy lift. */
  scaled: LeaderboardEntry[];
}

/** A benchmark on the records page, with the top of its leaderboards. */
export interface BenchmarkOverview {
  id: string;
  kind: BenchmarkKind;
  name: string;
  scoreType: BenchmarkScoreType;
  timeCapSeconds: number | null;
  exercises: { id: string; name: string }[];
  /** The first five. */
  rx: LeaderboardEntry[];
  rxCount: number;
  scaled: LeaderboardEntry[];
  scaledCount: number;
  /** The signed-in person's own rows (null when they're not on the list). */
  myRx: LeaderboardEntry | null;
  myScaled: LeaderboardEntry | null;
}

/** One of the signed-in person's own results. */
export interface BenchmarkResult extends Score {
  id: string;
  benchmark: {
    id: string;
    kind: BenchmarkKind;
    name: string;
    scoreType: BenchmarkScoreType;
    timeCapSeconds: number | null;
    isActive: boolean;
  };
  performedOn: string;
  scaled: boolean;
  note: string | null;
  /** Their best of this benchmark (Rx and scaled apart). */
  personalBest: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResultPayload {
  /** 'YYYY-MM-DD', the gym-local day; never in the future. */
  performedOn: string;
  scaled: boolean;
  timeSeconds?: number | null;
  capped?: boolean;
  rounds?: number | null;
  reps?: number | null;
  loadKg?: number | null;
  /** Empty or null: no note. */
  note: string | null;
}

export interface CreateResultPayload extends ResultPayload {
  benchmarkId: string;
}

@Injectable({
  providedIn: 'root',
})
export class BenchmarksService {
  private readonly baseUrl = `${environment.apiUrl}/benchmarks`;
  private readonly resultsUrl = `${environment.apiUrl}/benchmark-results`;

  constructor(private readonly http: HttpClient) {}

  /** Benchmarks first, then heavy lifts, by name. Trainees get the active ones only. */
  list(
    filters: { kind?: BenchmarkKind; active?: boolean } = {},
  ): Observable<Benchmark[]> {
    return this.http.get<Benchmark[]>(this.baseUrl, {
      params: buildHttpParams({ kind: filters.kind, active: filters.active }),
    });
  }

  getById(id: string): Observable<Benchmark> {
    return this.http.get<Benchmark>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateBenchmarkPayload): Observable<Benchmark> {
    return this.http.post<Benchmark>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateBenchmarkPayload): Observable<Benchmark> {
    return this.http.patch<Benchmark>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  /** Each person once with their best result, best first; Rx and scaled apart. */
  leaderboard(id: string): Observable<Leaderboard> {
    return this.http.get<Leaderboard>(`${this.baseUrl}/${id}/leaderboard`);
  }

  /** The records page: the active ones of a kind, each with the top of its leaderboards. */
  overview(kind: BenchmarkKind): Observable<BenchmarkOverview[]> {
    return this.http.get<BenchmarkOverview[]>(
      `${environment.apiUrl}/leaderboards`,
      { params: buildHttpParams({ kind }) },
    );
  }

  /** The signed-in person's results, newest first. */
  myResults(benchmarkId?: string): Observable<BenchmarkResult[]> {
    return this.http.get<BenchmarkResult[]>(`${this.resultsUrl}/mine`, {
      params: buildHttpParams({ benchmarkId }),
    });
  }

  getResult(id: string): Observable<BenchmarkResult> {
    return this.http.get<BenchmarkResult>(`${this.resultsUrl}/${id}`);
  }

  createResult(payload: CreateResultPayload): Observable<BenchmarkResult> {
    return this.http.post<BenchmarkResult>(this.resultsUrl, payload);
  }

  updateResult(
    id: string,
    payload: Partial<ResultPayload>,
  ): Observable<BenchmarkResult> {
    return this.http.patch<BenchmarkResult>(
      `${this.resultsUrl}/${id}`,
      payload,
    );
  }

  deleteResult(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.resultsUrl}/${id}`);
  }
}
