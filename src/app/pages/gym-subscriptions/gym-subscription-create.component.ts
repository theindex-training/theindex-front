import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CreateGymSubscriptionPayload,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';

@Component({
  selector: 'app-gym-subscription-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gym-subscription-create.component.html',
  styleUrl: './gym-subscription-create.component.scss'
})
export class GymSubscriptionCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
  }>;

  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120)
      ])
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateGymSubscriptionPayload = {
      name: raw.name.trim()
    };

    this.submitting = true;
    this.errorMessage = '';

    this.gymSubscriptionsService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gym-subscriptions']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to create this gym subscription right now.';
        this.submitting = false;
      }
    });
  }
}
