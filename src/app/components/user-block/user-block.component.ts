import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EnumLabelPipe } from '../../i18n/enum-label.pipe';
import { AuthService } from '../../services/auth.service';
import { MyProfileService } from '../../services/my-profile.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Signed-in user plus My details (trainees, trainers) / Change password / Log out, on the
 * navigation shell. Trainees and trainers show their profile photo, or their name's initials once
 * their profile has loaded; admins (no profile) and the moment before show the email's initials.
 */
@Component({
  selector: 'app-user-block',
  standalone: true,
  imports: [
    RouterLink,
    TranslocoPipe,
    EnumLabelPipe,
    AvatarComponent,
    IconComponent,
  ],
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
    private readonly myProfile: MyProfileService,
  ) {
    this.email = this.authService.getUserEmail();
    this.role = this.authService.getUserRole();
    this.hasProfile = this.role === 'TRAINEE' || this.role === 'TRAINER';
    this.initials =
      (this.email ?? '')
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 2)
        .toUpperCase() || 'U';
    this.myProfile.loadCurrent();
  }

  /** The name the avatar's initials come from: the profile's, else the email's two letters. */
  get avatarName(): string {
    return this.myProfile.current()?.name ?? this.initials;
  }

  get photoUrl(): string | null {
    return this.myProfile.current()?.photo?.thumbnailUrl ?? null;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
