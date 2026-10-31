import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService
} from '../../services/gym-subscriptions.service';
import {
  TraineeProfile,
  TraineesService,
  UpdateTraineePayload
} from '../../services/trainees.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { apiErrorMessage, i18nMessage, UiMessage } from '../../i18n/ui-message';

@Component({
  selector: 'app-trainee-edit',
  standalone: true,
  imports: [UiMessagePipe, TranslocoPipe, CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './trainee-edit.component.html'
})
export class TraineeEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
    phone: FormControl<string | null>;
    gymSubscriptionId: FormControl<string | null>;
  }>;

  trainee: TraineeProfile | null = null;
  gymSubscriptions: GymSubscription[] = [];
  loading = true;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly traineesService: TraineesService,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 100)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [trimmedLength(1, 50)]),
      phone: this.formBuilder.control<string | null>(null),
      gymSubscriptionId: this.formBuilder.control<string | null>(null)
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('trainees.errors.missingId');
      this.loading = false;
      return;
    }

    this.gymSubscriptionsService.list(true).subscribe({
      next: (gymSubscriptions) => {
        this.gymSubscriptions = gymSubscriptions;
        this.changeDetector.detectChanges();
      },
      error: () => {
        this.gymSubscriptions = [];
        this.changeDetector.detectChanges();
      }
    });

    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.form.patchValue({
          name: trainee.name,
          nickname: trainee.nickname,
          phone: trainee.phone,
          gymSubscriptionId: trainee.gymSubscriptionId
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'trainees.errors.load');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    if (!this.trainee) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateTraineePayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname),
      phone: this.normalizeOptional(raw.phone),
      gymSubscriptionId: raw.gymSubscriptionId
    };

    this.submitting = true;
    this.errorMessage = null;

    this.traineesService.update(this.trainee.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainees']);
      },
      error: (error) => {
        this.errorMessage =
          apiErrorMessage(error, 'trainees.edit.error');
        this.submitting = false;
      }
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
