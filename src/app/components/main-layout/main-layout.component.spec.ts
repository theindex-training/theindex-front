import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signInAs } from '../../../testing/jwt';
import { MainLayoutComponent } from './main-layout.component';

@Component({ template: '' })
class PageComponent {}

describe('MainLayoutComponent', () => {
  let harness: RouterTestingHarness;
  let layout: MainLayoutComponent;

  async function start(role: 'ADMIN' | 'TRAINER' | 'TRAINEE') {
    localStorage.clear();
    signInAs(role);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: '',
            component: MainLayoutComponent,
            children: [{ path: '**', component: PageComponent }],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
    layout = await harness.navigateByUrl('/home', MainLayoutComponent);
  }

  async function goTo(url: string) {
    await harness.navigateByUrl(url);
    return layout.isSheetPageActive();
  }

  it('builds the navigation for the signed-in role', async () => {
    await start('TRAINER');

    expect(layout.navigation.sheetLabel).toBe('nav.more');
    expect(layout.navigation.tabs.map((item) => item.route)).toEqual([
      '/home',
      '/workouts/schedule',
      '/attendance/new',
      '/trainees',
    ]);
    expect(layout.sheetItems.map((item) => item.route)).toContain(
      '/settlements',
    );
    expect(layout.sheetItems.map((item) => item.route)).not.toContain(
      '/trainers',
    );
  });

  it('marks the More tab as current on pages that live in the sheet', async () => {
    await start('ADMIN');

    expect(await goTo('/home')).toBe(false);
    expect(await goTo('/trainees/t1')).toBe(false);
    expect(await goTo('/plans')).toBe(true);
    expect(await goTo('/plans/p1/edit')).toBe(true);
    expect(await goTo('/attendance')).toBe(true);
    expect(await goTo('/attendance/new')).toBe(false);
    expect(await goTo('/cash-register?x=1')).toBe(true);
    expect(await goTo('/settlements/s1')).toBe(true);
    // The schedule is a tab, though its address is under Workouts (a sheet page).
    expect(await goTo('/workouts/schedule')).toBe(false);
    expect(await goTo('/workouts/exercises')).toBe(true);
  });

  it("marks only the current page's link in the sidebar, the tab bar and the sheet", async () => {
    await start('ADMIN');
    await harness.navigateByUrl('/workouts/schedule/s1');
    harness.detectChanges();
    const el = harness.fixture.nativeElement as HTMLElement;
    const current = (selector: string) =>
      [...el.querySelectorAll(`${selector} [aria-current="page"]`)].map(
        (link) => link.getAttribute('href'),
      );

    expect(current('app-sidebar')).toEqual(['/workouts/schedule']);
    expect(current('app-tab-bar')).toEqual(['/workouts/schedule']);
    // Workouts is in the sheet, and not current on the schedule.
    expect(current('app-nav-sheet')).toEqual([]);

    await harness.navigateByUrl('/workouts/exercises');
    harness.detectChanges();
    expect(current('app-sidebar')).toEqual(['/workouts']);
    expect(current('app-nav-sheet')).toEqual(['/workouts']);
    expect(current('app-tab-bar')).toEqual([]);
  });

  it('never marks the Account tab as current for trainees (their sheet has no pages)', async () => {
    await start('TRAINEE');

    expect(layout.navigation.sheetLabel).toBe('nav.account');
    expect(await goTo('/home')).toBe(false);
    expect(await goTo('/change-password')).toBe(false);
  });

  it('moves focus to the main content with "Skip to content"', async () => {
    await start('ADMIN');
    const el = harness.fixture.nativeElement as HTMLElement;

    layout.skipToContent();

    expect(document.activeElement).toBe(el.querySelector('main'));
  });
});
