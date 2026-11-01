import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { INITIAL_LANGUAGE } from './initial-language.token';
import { LANGUAGE_STORAGE_KEY, LanguageService } from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  // The global spec setup starts every app in English; these tests need the real startup logic.
  const create = () => {
    TestBed.configureTestingModule({ providers: [{ provide: INITIAL_LANGUAGE, useValue: null }] });
    return TestBed.inject(LanguageService);
  };

  it('defaults to Bulgarian whatever the browser language', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    const service = create();
    await firstValueFrom(service.init());

    expect(service.lang()).toBe('bg');
    expect(document.documentElement.lang).toBe('bg');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('bg');
    expect(service.t('nav.trainees')).toBe('Трениращи');
  });

  it('switches instantly, saves the choice and updates <html lang>', () => {
    const service = create();

    service.setLanguage('bg');
    expect(service.t('common.logOut')).toBe('Изход');

    service.setLanguage('en');
    expect(service.lang()).toBe('en');
    expect(service.t('common.logOut')).toBe('Log out');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores a saved choice and ignores invalid stored values', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const service = create();
    await firstValueFrom(service.init());
    expect(service.lang()).toBe('en');

    TestBed.resetTestingModule();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    const fresh = create();
    await firstValueFrom(fresh.init());
    expect(fresh.lang()).toBe('bg');
  });

  it('toggles between the two languages', () => {
    const service = create();
    service.setLanguage('bg');

    service.toggle();
    expect(service.lang()).toBe('en');
    service.toggle();
    expect(service.lang()).toBe('bg');
  });

  it('handles Bulgarian plurals', () => {
    const service = create();
    service.setLanguage('bg');
    const count = (total: number) => service.t('trainees.list.count', { shown: total, total });

    expect(count(1)).toBe('1 от 1 трениращ');
    expect(count(5)).toBe('5 от 5 трениращи');
    expect(service.t('plans.fields.daysCount', { count: 1 })).toBe('1 ден');
    expect(service.t('plans.fields.daysCount', { count: 30 })).toBe('30 дни');

    service.setLanguage('en');
    expect(count(1)).toBe('1 of 1 trainee');
    expect(count(5)).toBe('5 of 5 trainees');
  });
});
