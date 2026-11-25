import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { HolidaySwitchComponent } from '../../holidays/holiday-switch.component';
import { HolidayService } from '../../holidays/holiday.service';
import { IconComponent } from '../icon/icon.component';
import { LanguageSwitchComponent } from '../language-switch/language-switch.component';
import { NavGroup, NavItem, isItemActive } from '../navigation/navigation';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';
import { UserBlockComponent } from '../user-block/user-block.component';

/**
 * Mobile bottom sheet with the nav items that don't fit the tab bar, theme and language switches and account actions.
 * A modal <dialog> gives focus containment, Escape to close and an inert page behind it.
 */
@Component({
  selector: 'app-nav-sheet',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslocoPipe,
    HolidaySwitchComponent,
    IconComponent,
    LanguageSwitchComponent,
    ThemeSwitchComponent,
    UserBlockComponent,
  ],
  templateUrl: './nav-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './nav-sheet.component.scss',
})
export class NavSheetComponent {
  readonly holidays = inject(HolidayService);

  /** Translation key of the sheet title (the same as its tab). */
  @Input({ required: true }) title = 'nav.more';
  /** The pages that aren't tabs, by group. */
  @Input() groups: NavGroup[] = [];
  /** The current URL, for the active tile. */
  @Input() url = '';
  @Output() readonly openChange = new EventEmitter<boolean>();

  @ViewChild('dialog', { static: true })
  private readonly dialog!: ElementRef<HTMLDialogElement>;
  private returnFocusTo: HTMLElement | null = null;

  isActive(item: NavItem): boolean {
    return isItemActive(this.url, item);
  }

  get isOpen(): boolean {
    return this.dialog.nativeElement.open;
  }

  open(trigger?: HTMLElement): void {
    if (this.isOpen) {
      return;
    }
    this.returnFocusTo =
      trigger ?? (document.activeElement as HTMLElement | null);
    this.dialog.nativeElement.showModal();
    this.openChange.emit(true);
  }

  close(): void {
    if (this.isOpen) {
      this.dialog.nativeElement.close();
    }
  }

  // Fires for every close: the close button, Escape, a backdrop tap or a nav link.
  handleClose(): void {
    this.openChange.emit(false);
    this.returnFocusTo?.focus();
    this.returnFocusTo = null;
  }

  // A click whose target is the <dialog> itself landed on the backdrop, outside the panel.
  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog.nativeElement) {
      this.close();
    }
  }
}
