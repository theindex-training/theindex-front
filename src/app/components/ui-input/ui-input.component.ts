import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.scss',
  // `id` belongs on the inner <input>; leaving it on the host would duplicate it and break <label for>.
  host: { '[attr.id]': 'null' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiInputComponent),
      multi: true
    }
  ]
})
export class UiInputComponent implements ControlValueAccessor {
  @Input({ required: true }) id = '';
  @Input({ required: true }) label = '';
  @Input() type: 'text' | 'email' | 'password' = 'text';
  @Input() placeholder = '';
  @Input() autocomplete = '';
  @Input() describedBy: string | null = null;
  @Input() invalid = false;

  value = '';
  isDisabled = false;
  showPassword = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  get isPasswordField(): boolean {
    return this.type === 'password';
  }

  get inputType(): 'text' | 'email' | 'password' {
    if (this.isPasswordField && this.showPassword) {
      return 'text';
    }

    return this.type;
  }

  handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  handleBlur(): void {
    this.onTouched();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
}
