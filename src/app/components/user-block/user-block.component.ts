import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../icon/icon.component';

/** Signed-in user plus My details (trainees, trainers) / Change password / Log out, on the navigation shell. */
@Component({
  selector: 'app-user-block',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, EnumLabelPipe, IconComponent],
  templateUrl: './user-block.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-block.component.scss',
})
export class UserBlockComponent {
  /** `inline`: compact links (desktop sidebar). `list`: full-width rows (mobile sheet). */
  @Input() layout: 'inline' | 'list' = 'inline';

  readonly email: string | null;
  readonly role: string | null;
  readonly initials: string;
  /** Trainees and trainers have their own details to edit; admins have no profile. */
  readonly hasProfile: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.email = this.authService.getUserEmail();
    this.role = this.authService.getUserRole();
    this.hasProfile = this.role === 'TRAINEE' || this.role === 'TRAINER';
    this.initials =
      (this.email ?? '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 2)
        .toUpperCase() || 'U';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
