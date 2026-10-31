import { FormControl } from '@angular/forms';
import { trimmedLength } from './form-validators.util';

describe('trimmedLength', () => {
  const validate = (value: string | null) => trimmedLength(2, 5)(new FormControl(value));

  it('accepts empty values so optional fields can stay blank', () => {
    expect(validate(null)).toBeNull();
    expect(validate('')).toBeNull();
  });

  it('accepts values whose trimmed length is within the bounds', () => {
    expect(validate('ab')).toBeNull();
    expect(validate('  abcde  ')).toBeNull();
  });

  it('rejects values that are too short or too long once trimmed', () => {
    expect(validate(' a ')).toEqual({ length: { min: 2, max: 5, actual: 1 } });
    expect(validate('abcdef')).toEqual({ length: { min: 2, max: 5, actual: 6 } });
  });

  it('rejects whitespace-only text', () => {
    expect(validate('   ')).toEqual({ length: { min: 2, max: 5, actual: 0 } });
  });
});
