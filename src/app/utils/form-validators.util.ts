import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Checks the trimmed length, since forms trim text before sending it to the API. An empty value
// passes, so required fields pair it with Validators.required; whitespace-only text fails.
export function trimmedLength(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }

    const length = value.trim().length;
    return length >= min && length <= max ? null : { length: { min, max, actual: length } };
  };
}
