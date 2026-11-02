import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import bg from '../../../public/i18n/bg.json';
import en from '../../../public/i18n/en.json';
import { LanguageService } from './language.service';
import { TranslatedTitleStrategy } from './translated-title.strategy';

@Component({ template: '' })
class BlankComponent {}

describe('TranslatedTitleStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'plans', title: 'nav.plans', component: BlankComponent },
          { path: 'untitled', component: BlankComponent }
        ]),
        { provide: TitleStrategy, useClass: TranslatedTitleStrategy }
      ]
    });
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('titles the page "<page> · The Index" in the active language', async () => {
    await router.navigateByUrl('/plans');
    TestBed.tick();

    expect(title.getTitle()).toBe(`${en.nav.plans} · ${en.common.appName}`);
  });

  it('uses just the app name for a route without a title', async () => {
    await router.navigateByUrl('/untitled');
    TestBed.tick();

    expect(title.getTitle()).toBe(en.common.appName);
  });

  it('re-titles the page when the language changes', async () => {
    await router.navigateByUrl('/plans');
    TestBed.tick();

    TestBed.inject(LanguageService).use('bg').subscribe();
    TestBed.tick();

    expect(title.getTitle()).toBe(`${bg.nav.plans} · ${bg.common.appName}`);
  });
});
