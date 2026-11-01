import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreateGymSubscriptionPayload,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-gym-subscription-create',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './gym-subscription-create.component.html'
})
export class GymSubscriptionCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
  }>;

  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly router: Router
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 120)
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
    this.errorMessage = null;

    this.gymSubscriptionsService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gym-subscriptions']);
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'gymSubscriptions.create.error');
        this.submitting = false;
      }
    });
  }
}
