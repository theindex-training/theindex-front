import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GymLocation, GymLocationsService } from '../../services/gym-locations.service';

@Component({
  selector: 'app-gyms',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gyms.component.html',
  styleUrl: './gyms.component.scss'
})
export class GymsComponent implements OnInit {
  gyms: GymLocation[] = [];
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  loading = true;
  errorMessage = '';

  constructor(private readonly gymsService: GymLocationsService) {}

  ngOnInit(): void {
    this.loadGyms();
  }

  loadGyms(): void {
    this.loading = true;
    this.errorMessage = '';

    const includeInactive = this.activeFilter !== 'active';

    this.gymsService.list(includeInactive).subscribe({
      next: (gyms) => {
        this.gyms =
          this.activeFilter === 'inactive'
            ? gyms.filter((gym) => !gym.isActive)
            : gyms;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || 'Unable to load gyms right now.';
        this.loading = false;
      }
    });
  }

  formatAddress(gym: GymLocation): string {
    return gym.address?.trim() || '—';
  }
}
