import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

/**
 * A person's profile photo, or their initials in a rounded square when they have none (or it
 * can't be loaded). Decorative: the name must also be shown as text next to it.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  @Input({ required: true }) name = '';
  @Input() muted = false;
  /** Their profile photo (a square image), if they have one. */
  @Input() photoUrl: string | null | undefined = null;

  /** A photo that failed to load: its initials show instead. */
  failedUrl: string | null = null;

  get showPhoto(): boolean {
    return !!this.photoUrl && this.photoUrl !== this.failedUrl;
  }

  get initials(): string {
    const words = this.name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      return '?';
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  photoFailed(): void {
    this.failedUrl = this.photoUrl ?? null;
  }
}
