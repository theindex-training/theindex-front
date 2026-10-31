import { Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BrandComponent } from '../brand/brand.component';
import { NavSheetComponent } from '../nav-sheet/nav-sheet.component';
import { buildNavigation, isUrlInItems } from '../navigation/navigation';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TabBarComponent } from '../tab-bar/tab-bar.component';

/** Breakpoint where the sidebar replaces the top bar + tab bar. Keep in sync with main-layout.component.scss. */
const DESKTOP_QUERY = '(min-width: 1024px)';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, BrandComponent, SidebarComponent, TabBarComponent, NavSheetComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  private readonly router = inject(Router);

  readonly navigation = buildNavigation(inject(AuthService).getUserRole());
  readonly sheetItems = [...this.navigation.moreMain, ...this.navigation.moreManage];
  isSheetOpen = false;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  @ViewChild(NavSheetComponent) private readonly sheet?: NavSheetComponent;
  @ViewChild('main') private readonly main?: ElementRef<HTMLElement>;

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(() => this.sheet?.close());

    // The sheet is mobile-only; close it if the window grows into the desktop layout.
    const desktop = window.matchMedia?.(DESKTOP_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => event.matches && this.sheet?.close();
    desktop?.addEventListener('change', closeOnDesktop);
    destroyRef.onDestroy(() => desktop?.removeEventListener('change', closeOnDesktop));
  }

  /** Highlights the More/Account tab when the current page is one of the sheet's items. */
  isSheetPageActive(): boolean {
    return isUrlInItems(this.url(), this.sheetItems);
  }

  openSheet(trigger: HTMLElement): void {
    this.sheet?.open(trigger);
  }

  skipToContent(): void {
    this.main?.nativeElement.focus();
  }
}
