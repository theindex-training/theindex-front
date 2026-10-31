import { Component, Input } from '@angular/core';

/** Initials in a rounded square. Decorative: the name must also be shown as text next to it. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss'
})
export class AvatarComponent {
  @Input({ required: true }) name = '';
  @Input() muted = false;

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
}
