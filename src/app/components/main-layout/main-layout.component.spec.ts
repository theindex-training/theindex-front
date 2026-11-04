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
      '/trainees',
      '/attendance/new',
      '/settlements',
    ]);
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
  });

  it('never marks the Account tab as current for trainees (their sheet has no pages)', async () => {
    await start('TRAINEE');

    expect(layout.navigation.sheetLabel).toBe('nav.account');
    expect(await goTo('/my-profile')).toBe(false);
    expect(await goTo('/change-password')).toBe(false);
  });

  it('moves focus to the main content with "Skip to content"', async () => {
    await start('ADMIN');
    const el = harness.fixture.nativeElement as HTMLElement;

    layout.skipToContent();

    expect(document.activeElement).toBe(el.querySelector('main'));
  });
});
