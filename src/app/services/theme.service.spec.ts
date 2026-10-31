import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  let osPrefersDark: boolean;
  let listeners: Array<(event: { matches: boolean }) => void>;

  function setOsDark(matches: boolean): void {
    osPrefersDark = matches;
    listeners.forEach(listener => listener({ matches }));
  }

  function createService(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  const appliedTheme = () => document.documentElement.getAttribute('data-theme');

  beforeEach(() => {
    osPrefersDark = false;
    listeners = [];
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = ((query: string) => ({
      matches: osPrefersDark,
      media: query,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener)
    })) as unknown as typeof window.matchMedia;
    TestBed.resetTestingModule();
  });

  it('defaults to system mode and follows the OS preference', () => {
    osPrefersDark = true;
    const service = createService();

    expect(service.mode()).toBe('system');
    expect(service.resolvedTheme()).toBe('dark');
    expect(appliedTheme()).toBe('dark');
  });

  it('reacts to OS changes while in system mode', () => {
    const service = createService();
    expect(appliedTheme()).toBe('light');

    setOsDark(true);
    TestBed.tick();

    expect(service.resolvedTheme()).toBe('dark');
    expect(appliedTheme()).toBe('dark');
  });

  it('persists an explicit choice and ignores the OS while it is set', () => {
    const service = createService();

    service.setMode('dark');
    setOsDark(false);
    TestBed.tick();

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(appliedTheme()).toBe('dark');
  });

  it('restores a saved choice on startup', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    osPrefersDark = true;

    const service = createService();

    expect(service.mode()).toBe('light');
    expect(appliedTheme()).toBe('light');
  });

  it('cycles light -> dark -> system and clears storage for system', () => {
    const service = createService();
    service.setMode('light');

    service.cycleMode();
    expect(service.mode()).toBe('dark');

    service.cycleMode();
    expect(service.mode()).toBe('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    service.cycleMode();
    expect(service.mode()).toBe('light');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');

    expect(createService().mode()).toBe('system');
  });
});
