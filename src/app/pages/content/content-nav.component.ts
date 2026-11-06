import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

/** Switches between the sections of the content area (articles, categories). */
@Component({
  selector: 'app-content-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <nav
      class="content-nav"
      [attr.aria-label]="'content.nav.label' | transloco"
    >
      <a
        class="content-nav__link"
        routerLink="/content/articles"
        routerLinkActive="is-active"
        ariaCurrentWhenActive="page"
        >{{ 'content.nav.articles' | transloco }}</a
      >
      <a
        class="content-nav__link"
        routerLink="/content/categories"
        routerLinkActive="is-active"
        ariaCurrentWhenActive="page"
        >{{ 'content.nav.categories' | transloco }}</a
      >
    </nav>
  `,
  styles: `
    .content-nav {
      display: flex;
      gap: var(--space-1);
      border-bottom: 1px solid var(--border);
    }

    .content-nav__link {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch-target);
      padding: 0 var(--space-3);
      border-bottom: 3px solid transparent;
      margin-bottom: -1px;
      color: var(--muted);
      font-family: var(--font-heading);
      font-weight: 700;
      letter-spacing: var(--label-tracking);
      text-decoration: none;
      text-transform: uppercase;
    }

    .content-nav__link:hover {
      color: var(--text);
    }

    .content-nav__link.is-active {
      border-bottom-color: var(--accent);
      color: var(--text);
    }
  `,
})
export class ContentNavComponent {}
