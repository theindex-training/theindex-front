import { TranslationParams } from '../../i18n/ui-message';
import { BenchmarkScoreType, Score } from '../../services/benchmarks.service';

/** What a score needs to be read: translations and a locale number format. */
export interface ScoreFormat {
  t: (key: string, params?: TranslationParams) => string;
  number: (value: number) => string;
}

/** Seconds as people read a time: `m:ss`, or `h:mm:ss` from an hour. */
export function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * A score as text: "4:26"; "Time cap + 80 reps"; "12 rounds + 5 reps" ("12 rounds" without
 * reps); "50 reps"; "102.5 kg" (the locale's decimal sign).
 */
export function scoreText(
  score: Score,
  scoreType: BenchmarkScoreType,
  format: ScoreFormat,
): string {
  switch (scoreType) {
    case 'TIME':
      return score.capped
        ? format.t('records.score.capped', { reps: score.reps ?? 0 })
        : score.timeSeconds === null
          ? '—'
          : clock(score.timeSeconds);
    case 'ROUNDS_REPS':
      return score.reps
        ? format.t('records.score.roundsReps', {
            rounds: score.rounds ?? 0,
            reps: score.reps,
          })
        : format.t('records.score.rounds', { rounds: score.rounds ?? 0 });
    case 'REPS':
      return format.t('records.score.reps', { reps: score.reps ?? 0 });
    case 'LOAD':
      return format.t('records.score.load', {
        kg: format.number(score.loadKg ?? 0),
      });
  }
}

/** How it is scored, e.g. "For time · Time cap 10:00" (translated). */
export function scoringText(
  benchmark: { scoreType: BenchmarkScoreType; timeCapSeconds: number | null },
  t: ScoreFormat['t'],
): string {
  const type = t(`enums.scoreType.${benchmark.scoreType}`);
  return benchmark.timeCapSeconds
    ? t('records.scoringWithCap', {
        type,
        cap: clock(benchmark.timeCapSeconds),
      })
    : type;
}
