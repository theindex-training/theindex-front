import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreateGymLocationPayload,
  GymLocationsService,
} from '../../services/gym-locations.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-gym-create',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './gym-create.component.html'
})
export class GymCreateComponent {
  readonly form: FormGroup<{
    name: FormControl<string>;
    address: FormControl<string | null>;
  }>;

  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymsService: GymLocationsService,
    private readonly router: Router,
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 120),
      ]),
      address: this.formBuilder.control<string | null>(null, [trimmedLength(2, 250)]),
    });
  }

  handleSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateGymLocationPayload = {
      name: raw.name.trim(),
      address: this.normalizeOptional(raw.address),
    };

    this.submitting = true;
    this.errorMessage = null;

    this.gymsService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gyms']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'gyms.create.error');
        this.submitting = false;
      },
    });
  }

  private normalizeOptional(value: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
}
