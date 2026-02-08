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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Plan,
  PlanType,
  PlansService,
  UpdatePlanPayload
} from '../../services/plans.service';

const integerValidator: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number.isInteger(Number(value)) ? null : { integer: true };
};

@Component({
  selector: 'app-plan-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './plan-edit.component.html',
  styleUrl: './plan-edit.component.scss'
})
export class PlanEditComponent implements OnInit {
  readonly form: FormGroup<{
    type: FormControl<PlanType>;
    title: FormControl<string>;
    priceCents: FormControl<number>;
    credits: FormControl<number | null>;
    durationDays: FormControl<number | null>;
    isActive: FormControl<boolean>;
  }>;

  plan: Plan | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly plansService: PlansService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      type: this.formBuilder.nonNullable.control<PlanType>('PUNCH', [Validators.required]),
      title: this.formBuilder.nonNullable.control('', [Validators.required]),
      priceCents: this.formBuilder.nonNullable.control(0, [
        Validators.required,
        Validators.min(0),
        integerValidator
      ]),
      credits: this.formBuilder.control<number | null>(null),
      durationDays: this.formBuilder.control<number | null>(null),
      isActive: this.formBuilder.nonNullable.control(true)
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Plan ID is missing.';
      this.loading = false;
      return;
    }

    this.form.controls.type.valueChanges.subscribe((value) => {
      this.syncTypeValidators(value);
    });

    this.plansService.getById(id).subscribe({
      next: (plan) => {
        this.plan = plan;
        this.form.patchValue({
          type: plan.type,
          title: plan.title,
          priceCents: plan.priceCents,
          credits: plan.credits,
          durationDays: plan.durationDays,
          isActive: plan.isActive
        });
        this.syncTypeValidators(plan.type);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this plan.';
        this.loading = false;
      }
    });
  }

  handleSubmit(): void {
    if (!this.plan) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdatePlanPayload = {
      type: raw.type,
      title: raw.title.trim(),
      priceCents: Number(raw.priceCents),
      isActive: raw.isActive,
      credits: raw.type === 'PUNCH' ? Number(raw.credits) : null,
      durationDays: raw.type === 'TIME' ? Number(raw.durationDays) : null
    };

    this.submitting = true;
    this.errorMessage = '';

    this.plansService.update(this.plan.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/plans']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this plan right now.';
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
}
