import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  GymSubscription,
  GymSubscriptionsService,
  UpdateGymSubscriptionPayload
} from '../../services/gym-subscriptions.service';

@Component({
  selector: 'app-gym-subscription-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gym-subscription-edit.component.html',
  styleUrl: './gym-subscription-edit.component.scss'
})
export class GymSubscriptionEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
  }>;

  gymSubscription: GymSubscription | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymSubscriptionsService: GymSubscriptionsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(120)
      ])
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Gym subscription ID is missing.';
      this.loading = false;
      return;
    }

    this.gymSubscriptionsService.getById(id).subscribe({
      next: (gymSubscription) => {
        this.gymSubscription = gymSubscription;
        this.form.patchValue({
          name: gymSubscription.name
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'Unable to load this gym subscription.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    if (!this.gymSubscription) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateGymSubscriptionPayload = {
      name: raw.name.trim()
    };

    this.submitting = true;
    this.errorMessage = '';

    this.gymSubscriptionsService.update(this.gymSubscription.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gym-subscriptions']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this gym subscription right now.';
        this.submitting = false;
      }
    });
  }
}
