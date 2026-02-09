import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';

@Component({
  selector: 'app-gym-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gym-details.component.html',
  styleUrl: './gym-details.component.scss'
})
export class GymDetailsComponent implements OnInit {
  gym: GymLocation | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private readonly gymsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

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

  formatAddress(): string {
    if (!this.gym) {
      return '—';
    }
    return this.gym.address?.trim() || '—';
  }
}
