import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { NavItem } from '../navigation/navigation';
import { ThemeSwitchComponent } from '../theme-switch/theme-switch.component';
import { UserBlockComponent } from '../user-block/user-block.component';

/**
 * Mobile bottom sheet with the nav items that don't fit the tab bar, the theme switch and account actions.
 * A modal <dialog> gives focus containment, Escape to close and an inert page behind it.
 */
@Component({
  selector: 'app-nav-sheet',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, IconComponent, ThemeSwitchComponent, UserBlockComponent],
  templateUrl: './nav-sheet.component.html',
  styleUrl: './nav-sheet.component.scss'
})
export class NavSheetComponent {
  @Input({ required: true }) title = 'More';
  @Input() mainItems: NavItem[] = [];
  @Input() manageItems: NavItem[] = [];
  @Output() readonly openChange = new EventEmitter<boolean>();

  @ViewChild('dialog', { static: true }) private readonly dialog!: ElementRef<HTMLDialogElement>;
  private returnFocusTo: HTMLElement | null = null;

  get isOpen(): boolean {
    return this.dialog.nativeElement.open;
  }

  open(trigger?: HTMLElement): void {
    if (this.isOpen) {
      return;
    }
    this.returnFocusTo = trigger ?? (document.activeElement as HTMLElement | null);
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
