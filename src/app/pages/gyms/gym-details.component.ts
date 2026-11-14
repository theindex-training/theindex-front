import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GymLocation,
  GymLocationsService,
} from '../../services/gym-locations.service';

import { AuthService } from '../../services/auth.service';
import { displayValue } from '../../utils/display.util';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { UiMessagePipe } from '../../i18n/ui-message.pipe';
import { i18nMessage, UiMessage } from '../../i18n/ui-message';
import {
  recordLoadError,
  rejectDeleted,
} from '../../utils/deleted-record.util';

@Component({
  selector: 'app-gym-details',
  standalone: true,
  imports: [
    UiMessagePipe,
    TranslocoPipe,
    CommonModule,
    RouterLink,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './gym-details.component.html',
})
export class GymDetailsComponent implements OnInit {
  gym: GymLocation | null = null;
  loading = true;
  errorMessage: UiMessage | null = null;
  /** Only admins change a gym's weekly template. */
  readonly isAdmin: boolean;

  constructor(
    private readonly gymsService: GymLocationsService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef,
    auth: AuthService,
  ) {
    this.isAdmin = auth.getUserRole() === 'ADMIN';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = i18nMessage('gyms.errors.missingId');
      this.loading = false;
      return;
    }

    this.gymsService
      .getById(id)
      .pipe(rejectDeleted())
      .subscribe({
        next: (gym) => {
          this.gym = gym;
          this.loading = false;
          this.changeDetector.detectChanges();
        },
        error: (error) => {
          this.errorMessage = recordLoadError(
            error,
            'gyms.errors.notFound',
            'gyms.errors.load',
          );
          this.loading = false;
          this.changeDetector.detectChanges();
        },
      });
  }

  formatAddress(): string {
    if (!this.gym) {
      return '—';
    }
    return displayValue(this.gym.address);
  }
}
