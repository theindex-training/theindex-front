import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CreatePlanPayload, PlanType, PlansService } from '../../services/plans.service';

const integerValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integer: true };
};

const currencyValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { currency: true };
  }

  const cents = Math.round(numericValue * 100);
  const difference = Math.abs(cents - numericValue * 100);
  return difference < 1e-6 ? null : { currency: true };
};

@Component({
  selector: 'app-plan-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './plan-create.component.html',
  styleUrl: './plan-create.component.scss'
})
export class PlanCreateComponent implements OnInit {
  readonly form: FormGroup<{
    type: FormControl<PlanType>;
    title: FormControl<string>;
    price: FormControl<number>;
    credits: FormControl<number | null>;
    durationDays: FormControl<number | null>;
    isActive: FormControl<boolean>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly plansService: PlansService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      type: this.formBuilder.nonNullable.control<PlanType>('PUNCH', [Validators.required]),
      title: this.formBuilder.nonNullable.control('', [Validators.required]),
      price: this.formBuilder.nonNullable.control(0, [
        Validators.required,
        currencyValidator
      ]),
      credits: this.formBuilder.control<number | null>(null),
      durationDays: this.formBuilder.control<number | null>(null),
      isActive: this.formBuilder.nonNullable.control(true)
    });
  }

  ngOnInit(): void {
    this.syncTypeValidators(this.form.controls.type.value);
    this.form.controls.type.valueChanges.subscribe((value) => {
      this.syncTypeValidators(value);
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreatePlanPayload = {
      type: raw.type,
      title: raw.title.trim(),
      priceCents: this.toCents(raw.price),
      isActive: raw.isActive
    };

    if (raw.type === 'PUNCH') {
      payload.credits = Number(raw.credits);
    } else {
      payload.durationDays = Number(raw.durationDays);
    }

    this.submitting = true;
    this.errorMessage = '';

    this.plansService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/plans']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to create this plan right now.';
        this.submitting = false;
      }
    });
  }

  private syncTypeValidators(type: PlanType): void {
    const creditsControl = this.form.controls.credits;
    const durationControl = this.form.controls.durationDays;

    if (type === 'PUNCH') {
      creditsControl.setValidators([
        Validators.required,
        Validators.min(1),
        integerValidator
      ]);
      durationControl.clearValidators();
      durationControl.setValue(null);
    } else {
      durationControl.setValidators([
        Validators.required,
        Validators.min(1),
        integerValidator
      ]);
      creditsControl.clearValidators();
      creditsControl.setValue(null);
    }

    creditsControl.updateValueAndValidity();
    durationControl.updateValueAndValidity();
  }

  private toCents(price: number): number {
    return Math.round(price * 100);
  }
}
