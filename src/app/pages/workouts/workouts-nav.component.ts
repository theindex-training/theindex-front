import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Switches between the sections of the workouts area (workouts, exercises). */
@Component({
  selector: 'app-workouts-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <nav
      class="section-nav"
      [attr.aria-label]="'workouts.nav.label' | transloco"
    >
      <a
        class="section-nav__link"
        routerLink="/workouts"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: true }"
        ariaCurrentWhenActive="page"
        >{{ 'workouts.nav.workouts' | transloco }}</a
      >
      <a
        class="section-nav__link"
        routerLink="/workouts/exercises"
        routerLinkActive="is-active"
        ariaCurrentWhenActive="page"
        >{{ 'workouts.nav.exercises' | transloco }}</a
      >
    </nav>
  `,
  styles: `
    .section-nav {
      display: flex;
      gap: var(--space-1);
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }

    .section-nav__link {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-target);
      padding: 0 var(--space-3);
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font-family: var(--font-heading);
      font-weight: 700;
      letter-spacing: var(--label-tracking);
      text-decoration: none;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .section-nav__link:hover {
      color: var(--text);
    }

    .section-nav__link.is-active {
      border-bottom-color: var(--accent);
      color: var(--text);
    }
  `,
})
export class WorkoutsNavComponent {}
