import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  GymLocation,
  GymLocationsService,
  UpdateGymLocationPayload,
} from '../../services/gym-locations.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-gym-edit',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './gym-edit.component.html'
})
export class GymEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    address: FormControl<string | null>;
  }>;

  gym: GymLocation | null = null;
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 120),
      ]),
      address: this.formBuilder.control<string | null>(null, [trimmedLength(2, 250)]),
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('gyms.errors.missingId');
      this.loading = false;
      return;
    }

    this.gymsService.getById(id).subscribe({
      next: (gym) => {
        this.gym = gym;
        this.form.patchValue({
          name: gym.name,
          address: gym.address,
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'gyms.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      },
    });
  }

  handleSubmit(): void {
    if (!this.gym) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateGymLocationPayload = {
      name: raw.name.trim(),
      address: this.normalizeOptional(raw.address),
    };

    this.submitting = true;
    this.errorMessage = null;

    this.gymsService.update(this.gym.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gyms']);
      },
      error: (error) => {
        this.errorMessage = apiErrorMessage(error, 'gyms.edit.error');
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
