import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import {
  applyKindRules,
  BenchmarkForm,
  buildBenchmarkForm,
  createBenchmarkPayload,
  fillBenchmarkForm,
  updateBenchmarkPayload,
} from './benchmark-form';

function form(): BenchmarkForm {
  const f = buildBenchmarkForm(TestBed.inject(FormBuilder));
  applyKindRules(f);
  return f;
}

describe('benchmark form', () => {
  it('a benchmark needs a name and a description; sends its time cap in seconds', () => {
    const f = form();
    expect(f.valid).toBe(false);
    f.patchValue({ name: '  Fran ', description: ' 21-15-9 ' });
    f.controls.description.updateValueAndValidity();
    f.controls.timeCapMinutes.setValue(10);

    expect(f.valid).toBe(true);
    expect(createBenchmarkPayload(f, ['e1', 'e2'])).toEqual({
      kind: 'BENCHMARK',
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: 600,
      description: '21-15-9',
      exerciseIds: ['e1', 'e2'],
      isActive: true,
    });
  });

  it('drops the time cap for any other score type', () => {
    const f = form();
    f.patchValue({
      name: 'Cindy',
      description: 'AMRAP 20',
      timeCapMinutes: 10,
    });
    f.controls.scoreType.setValue('ROUNDS_REPS');
    applyKindRules(f);

    expect(f.controls.timeCapMinutes.disabled).toBe(true);
    expect(createBenchmarkPayload(f, ['e1'])).toMatchObject({
      scoreType: 'ROUNDS_REPS',
      timeCapSeconds: null,
    });
  });

  it('refuses a time cap that is not whole minutes from 1', () => {
    const f = form();
    f.controls.timeCapMinutes.setValue(0);
    expect(f.controls.timeCapMinutes.invalid).toBe(true);
    f.controls.timeCapMinutes.setValue(7.5);
    expect(f.controls.timeCapMinutes.invalid).toBe(true);
  });

  it('a heavy lift needs no description and sends no score type or time cap', () => {
    const f = form();
    f.controls.kind.setValue('LIFT');
    applyKindRules(f);
    f.controls.name.setValue('Deadlift');

    expect(f.valid).toBe(true);
    expect(createBenchmarkPayload(f, ['e1'])).toEqual({
      kind: 'LIFT',
      name: 'Deadlift',
      description: '',
      exerciseIds: ['e1'],
      isActive: true,
    });
  });

  it('fills an existing one back in and sends everything but the kind', () => {
    const f = form();
    fillBenchmarkForm(f, {
      id: 'b1',
      kind: 'BENCHMARK',
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: 480,
      description: 'For time',
      exercises: [],
      isActive: false,
      resultCount: 0,
    });

    expect(updateBenchmarkPayload(f, ['e1'])).toEqual({
      name: 'Fran',
      scoreType: 'TIME',
      timeCapSeconds: 480,
      description: 'For time',
      exerciseIds: ['e1'],
      isActive: false,
    });
  });
});
