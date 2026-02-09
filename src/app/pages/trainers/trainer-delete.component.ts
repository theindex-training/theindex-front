import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TrainerProfile, TrainersService } from '../../services/trainers.service';

@Component({
  selector: 'app-trainer-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './trainer-delete.component.html',
  styleUrl: './trainer-delete.component.scss'
})
export class TrainerDeleteComponent implements OnInit {
  trainer: TrainerProfile | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly trainersService: TrainersService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

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

  confirmDeactivate(): void {
    if (!this.trainer) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.trainersService.deactivate(this.trainer.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/trainers']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this trainer right now.';
        this.submitting = false;
      }
    });
  }

  formatNickname(): string {
    return this.trainer?.nickname?.trim() || '—';
  }

  formatAccount(): string {
    return this.trainer?.accountId ? 'Linked' : 'Unlinked';
  }
}
