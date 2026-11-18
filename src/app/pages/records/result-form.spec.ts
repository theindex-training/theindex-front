import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { BenchmarkResult } from '../../services/benchmarks.service';
import {
  applyScoreRules,
  buildResultForm,
  fillFromResult,
  ResultForm,
  resultPayload,
  ScoreRules,
} from './result-form';

const TODAY = '2026-11-18';
const FRAN: ScoreRules = { scoreType: 'TIME', timeCapSeconds: 600 };
const CINDY: ScoreRules = { scoreType: 'ROUNDS_REPS', timeCapSeconds: null };
const MAX_REPS: ScoreRules = { scoreType: 'REPS', timeCapSeconds: null };
const LIFT: ScoreRules = { scoreType: 'LOAD', timeCapSeconds: null };

function form(rules: ScoreRules): ResultForm {
  const f = buildResultForm(TestBed.inject(FormBuilder), TODAY);
  applyScoreRules(f, rules);
  return f;
}

describe('result form', () => {
  it('starts on today, and refuses a day after it', () => {
    const f = form(FRAN);
    expect(f.controls.performedOn.value).toBe(TODAY);

    f.controls.performedOn.setValue('2026-11-19');
    expect(f.controls.performedOn.hasError('future')).toBe(true);
    f.controls.performedOn.setValue('2026-06-20');
    expect(f.controls.performedOn.valid).toBe(true);
  });

  describe('TIME', () => {
    it('sends minutes and seconds as seconds, and only the time', () => {
      const f = form(FRAN);
      f.patchValue({ minutes: 4, seconds: 26, note: '  great  ' });
      expect(f.valid).toBe(true);

      expect(resultPayload(f, FRAN)).toEqual({
        performedOn: TODAY,
        scaled: false,
        timeSeconds: 266,
        capped: false,
        rounds: null,
        reps: null,
        loadKg: null,
        note: 'great',
      });
    });

    it('needs a time of at least a second, within the time cap', () => {
      const f = form(FRAN);
      expect(f.hasError('time')).toBe(true);
      f.patchValue({ minutes: 0, seconds: 0 });
      expect(f.hasError('time')).toBe(true);
      f.patchValue({ minutes: 10, seconds: 1 });
      expect(f.hasError('overCap')).toBe(true);
      f.patchValue({ minutes: 10, seconds: 0 });
      expect(f.valid).toBe(true);
      f.patchValue({ seconds: 60 });
      expect(f.controls.seconds.invalid).toBe(true);
    });

    it('takes the reps done instead when capped, and sends no time', () => {
      const f = form(FRAN);
      f.patchValue({ minutes: 9, seconds: 59 });
      f.controls.capped.setValue(true);
      applyScoreRules(f, FRAN);
      expect(f.controls.minutes.disabled).toBe(true);
      expect(f.valid).toBe(false); // the reps are required
      f.controls.reps.setValue(80);

      expect(f.valid).toBe(true);
      expect(resultPayload(f, FRAN)).toMatchObject({
        timeSeconds: null,
        capped: true,
        reps: 80,
      });
    });

    it('offers no "capped" without a time cap', () => {
      const rules: ScoreRules = { scoreType: 'TIME', timeCapSeconds: null };
      const f = form(rules);
      expect(f.controls.capped.disabled).toBe(true);
      f.patchValue({ minutes: 70, seconds: 0 });
      expect(f.valid).toBe(true);
    });
  });

  it('ROUNDS_REPS: needs rounds; the extra reps are 0 when left empty', () => {
    const f = form(CINDY);
    expect(f.valid).toBe(false);
    f.controls.rounds.setValue(12);

    expect(f.valid).toBe(true);
    expect(resultPayload(f, CINDY)).toMatchObject({
      timeSeconds: null,
      rounds: 12,
      reps: 0,
      loadKg: null,
    });
    f.controls.rounds.setValue(2.5);
    expect(f.valid).toBe(false);
  });

  it('REPS: sends the reps', () => {
    const f = form(MAX_REPS);
    f.controls.reps.setValue(42);
    expect(resultPayload(f, MAX_REPS)).toMatchObject({
      reps: 42,
      rounds: null,
    });
  });

  it('LOAD: kg in steps of 0.5, never scaled', () => {
    const f = form(LIFT);
    f.controls.scaled.setValue(true);
    applyScoreRules(f, LIFT);
    f.controls.loadKg.setValue(102.25);
    expect(f.controls.loadKg.hasError('halfKilo')).toBe(true);
    f.controls.loadKg.setValue(102.5);

    expect(f.valid).toBe(true);
    expect(resultPayload(f, LIFT)).toMatchObject({
      scaled: false,
      loadKg: 102.5,
      timeSeconds: null,
      reps: null,
    });
  });

  it('fills an existing result back in, its time as minutes and seconds', () => {
    const f = form(FRAN);
    fillFromResult(f, {
      performedOn: '2026-06-20',
      timeSeconds: 266,
      capped: false,
      rounds: null,
      reps: null,
      loadKg: null,
      scaled: true,
      note: 'Band pull-ups',
    } as BenchmarkResult);

    expect(f.getRawValue()).toMatchObject({
      performedOn: '2026-06-20',
      minutes: 4,
      seconds: 26,
      scaled: true,
      note: 'Band pull-ups',
    });
    expect(resultPayload(f, FRAN)).toMatchObject({
      timeSeconds: 266,
      scaled: true,
      note: 'Band pull-ups',
    });
  });
});
