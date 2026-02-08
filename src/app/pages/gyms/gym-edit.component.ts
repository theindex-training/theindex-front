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
  GymLocation,
  GymLocationsService,
  UpdateGymLocationPayload
} from '../../services/gym-locations.service';

@Component({
  selector: 'app-gym-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './gym-edit.component.html',
  styleUrl: './gym-edit.component.scss'
})
export class GymEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    address: FormControl<string | null>;
    notes: FormControl<string | null>;
  }>;

  gym: GymLocation | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly gymsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      address: this.formBuilder.control<string | null>(null),
      notes: this.formBuilder.control<string | null>(null)
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Gym ID is missing.';
      this.loading = false;
      return;
    }

    this.gymsService.getById(id).subscribe({
      next: (gym) => {
        this.gym = gym;
        this.form.patchValue({
          name: gym.name,
          address: gym.address,
          notes: gym.notes
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this gym.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
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
      notes: this.normalizeOptional(raw.notes)
    };

    this.submitting = true;
    this.errorMessage = '';

    this.gymsService.update(this.gym.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gyms']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this gym right now.';
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
