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
  TrainerProfile,
  TrainersService,
  UpdateTrainerPayload
} from '../../services/trainers.service';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { trimmedLength } from '../../utils/form-validators.util';

@Component({
  selector: 'app-trainer-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './trainer-edit.component.html'
})
export class TrainerEditComponent implements OnInit {
  readonly form: FormGroup<{
    name: FormControl<string>;
    nickname: FormControl<string | null>;
  }>;

  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {
    this.form = this.formBuilder.group({
      name: this.formBuilder.nonNullable.control('', [
        Validators.required,
        trimmedLength(2, 100)
      ]),
      nickname: this.formBuilder.control<string | null>(null, [trimmedLength(1, 50)])
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainer ID is missing.';
      this.loading = false;
      return;
    }

    this.trainersService.getById(id).subscribe({
      next: (trainer) => {
        this.trainer = trainer;
        this.form.patchValue({
          name: trainer.name,
          nickname: trainer.nickname
        });
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainer.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  handleSubmit(): void {
    if (!this.trainer) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: UpdateTrainerPayload = {
      name: raw.name.trim(),
      nickname: this.normalizeOptional(raw.nickname)
    };

    this.submitting = true;
    this.errorMessage = '';

    this.trainersService.update(this.trainer.id, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to update this trainer right now.';
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
