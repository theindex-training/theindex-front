import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Tappable mobile list row: avatar, title (+ muted suffix), a meta line, a trailing slot and a chevron.
 * The whole row is one link. Put it in an <li> inside a `ul.list-card`.
 *
 * Content slots: `[listRowMeta]` (second line, e.g. phone) and `[listRowTrailing]` (e.g. an app-chip).
 */
@Component({
  selector: 'app-list-row',
  standalone: true,
  imports: [RouterLink, AvatarComponent, IconComponent],
  templateUrl: './list-row.component.html',
  styleUrl: './list-row.component.scss'
})
export class ListRowComponent {
  @Input({ required: true }) link!: string | unknown[];
  @Input({ required: true }) title = '';
  /** Shown after the title in muted text, e.g. a nickname. */
  @Input() titleSuffix = '';
  /** Name for the initials avatar; omit to hide the avatar. */
  @Input() avatarName = '';
  /** De-emphasizes the row (e.g. inactive records) while keeping text contrast ≥ 4.5:1. */
  @Input() dimmed = false;
}
