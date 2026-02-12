import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TraineeProfile, TraineesService } from '../../services/trainees.service';

import { displayValue } from '../../utils/display.util';

@Component({
  selector: 'app-trainee-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainee-delete.component.html',
  styleUrl: './trainee-delete.component.scss'
})
export class TraineeDeleteComponent implements OnInit {
  trainee: TraineeProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly traineesService: TraineesService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'Trainee ID is missing.';
      this.loading = false;
      return;
    }

    this.traineesService.getById(id).subscribe({
      next: (trainee) => {
        this.trainee = trainee;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this trainee.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.trainee) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.traineesService.deactivate(this.trainee.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainees']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this trainee right now.';
        this.submitting = false;
      }
    });
  }

  formatNickname(): string {
    return displayValue(this.trainee?.nickname);
  }

  formatPhone(): string {
    return displayValue(this.trainee?.phone);
  }

  formatAccount(): string {
    return this.trainee?.accountId ? 'Linked' : 'Unlinked';
  }
}
