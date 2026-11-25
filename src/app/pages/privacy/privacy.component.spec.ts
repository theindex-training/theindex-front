import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../../public/i18n/en.json';
import { LanguageService } from '../../i18n/language.service';
import { signInAs } from '../../../testing/jwt';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PrivacyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render() {
    const fixture = TestBed.createComponent(PrivacyComponent);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const testid = (el: HTMLElement, id: string) =>
    el.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

  it('shows the whole policy, the controller and when it last changed, asking the API nothing', async () => {
    const el = await render();

    expect(el.querySelector('h1')?.textContent?.trim()).toBe(en.privacy.title);
    expect(testid(el, 'privacy-controller')).toBe(en.privacy.controller.text);
    expect(testid(el, 'privacy-updated')).toBe(
      en.privacy.updated.replace('{date}', '25 Nov 2026'),
    );
    const headings = [...el.querySelectorAll('h2')].map((h) =>
      h.textContent?.trim(),
    );
    expect(headings).toEqual([
      en.privacy.controller.heading,
      en.privacy.data.heading,
      en.privacy.purposes.heading,
      en.privacy.visibility.heading,
      en.privacy.processors.heading,
      en.privacy.retention.heading,
      en.privacy.storage.heading,
      en.privacy.rights.heading,
      en.privacy.security.heading,
      en.privacy.changes.heading,
    ]);
    expect(el.textContent).toContain(en.privacy.rights.complaint);
  });

  it('links a signed-out reader back to sign in', async () => {
    const el = await render();

    const back = el.querySelector<HTMLAnchorElement>('.privacy__back')!;
    expect(back.textContent?.trim()).toBe(en.privacy.backToLogin);
    expect(back.getAttribute('href')).toBe('/login');
  });

  it('links a signed-in reader back to the app', async () => {
    signInAs('TRAINEE');
    const el = await render();

    const back = el.querySelector<HTMLAnchorElement>('.privacy__back')!;
    expect(back.textContent?.trim()).toBe(en.privacy.backToApp);
    expect(back.getAttribute('href')).toBe('/home');
  });

  it('reads in Bulgarian, with the date in Bulgarian', async () => {
    TestBed.inject(LanguageService).use('bg').subscribe();
    const el = await render();

    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Политика за поверителност',
    );
    expect(testid(el, 'privacy-controller')).toContain('„В.С. Груп“ ЕООД');
    // The Bulgarian date has a no-break space before "г.".
    expect(testid(el, 'privacy-updated')).toMatch(
      /^Последна промяна: 25\.11\.2026\sг\.$/,
    );
  });
});
