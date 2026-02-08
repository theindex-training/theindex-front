import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';

@Component({
  selector: 'app-gym-delete',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './gym-delete.component.html',
  styleUrl: './gym-delete.component.scss'
})
export class GymDeleteComponent implements OnInit {
  gym: GymLocation | null = null;
  loading = true;
  submitting = false;
  errorMessage = '';

  constructor(
    private readonly gymsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
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
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load this gym.';
        this.loading = false;
      }
    });
  }

  confirmDeactivate(): void {
    if (!this.gym) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.gymsService.deactivate(this.gym.id).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/gyms']);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to deactivate this gym right now.';
        this.submitting = false;
      }
    });
  }
}
