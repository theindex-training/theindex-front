import { Component, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IconComponent } from '../icon/icon.component';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  TRAINER: 'Trainer',
  TRAINEE: 'Trainee'
};

/** Signed-in user plus Change password / Log out, on the navigation shell. */
@Component({
  selector: 'app-user-block',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './user-block.component.html',
  styleUrl: './user-block.component.scss'
})
export class UserBlockComponent {
  /** `inline`: compact links (desktop sidebar). `list`: full-width rows (mobile sheet). */
  @Input() layout: 'inline' | 'list' = 'inline';

  readonly email: string;
  readonly roleLabel: string;
  readonly initials: string;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    this.email = this.authService.getUserEmail() ?? 'User';
    const role = this.authService.getUserRole();
    this.roleLabel = (role && ROLE_LABELS[role]) ?? 'Signed in';
    this.initials = this.email.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'U';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
