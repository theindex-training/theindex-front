import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

export interface PageHeaderAction {
  /** Visible on desktop; the accessible name of the floating button on mobile. */
  label: string;
  link: string | unknown[];
}

/**
 * Page title, one-line subtitle and an optional primary "create" action. The action is a button in the
 * header on desktop and a floating "+" button above the tab bar below 1024px (where the tab bar shows).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() action?: PageHeaderAction;
  /** "Back to …" link shown above the title on detail/form pages. */
  @Input() back?: PageHeaderAction;
}
