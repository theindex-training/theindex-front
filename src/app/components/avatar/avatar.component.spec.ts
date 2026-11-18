import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

describe('AvatarComponent initials', () => {
  const initials = (name: string) =>
    Object.assign(new AvatarComponent(), { name }).initials;

  it('uses the first letters of the first and last word', () => {
    expect(initials('Georgi Ivanov')).toBe('GI');
    expect(initials('Aleksandra Nikolova Vasileva')).toBe('AV');
  });

  it('uses two letters of a single word and ignores extra whitespace', () => {
    expect(initials('  admin ')).toBe('AD');
    expect(initials('Maria   Petrova')).toBe('MP');
  });

  it('falls back to "?" for an empty name', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('AvatarComponent photo', () => {
  async function render(inputs: { name: string; photoUrl?: string | null }) {
    const fixture = TestBed.createComponent(AvatarComponent);
    fixture.componentRef.setInput('name', inputs.name);
    if (inputs.photoUrl !== undefined) {
      fixture.componentRef.setInput('photoUrl', inputs.photoUrl);
    }
    await fixture.whenStable();
    return fixture;
  }

  const photoOf = (el: HTMLElement) =>
    el.querySelector<HTMLImageElement>('img[data-testid="avatar-photo"]');

  it('shows the photo instead of the initials when there is one', async () => {
    const fixture = await render({
      name: 'Georgi Ivanov',
      photoUrl: 'https://media.test/profile-photos/p/s128.webp',
    });
    const el = fixture.nativeElement as HTMLElement;

    expect(photoOf(el)?.getAttribute('src')).toBe(
      'https://media.test/profile-photos/p/s128.webp',
    );
    expect(photoOf(el)?.getAttribute('alt')).toBe('');
    expect(el.textContent?.trim()).toBe('');
  });

  it('shows the initials without a photo', async () => {
    for (const photoUrl of [null, '']) {
      const el = (await render({ name: 'Georgi Ivanov', photoUrl }))
        .nativeElement as HTMLElement;
      expect(photoOf(el)).toBeNull();
      expect(el.textContent?.trim()).toBe('GI');
    }
  });

  it('falls back to the initials when the photo fails to load, until another photo comes', async () => {
    const fixture = await render({
      name: 'Georgi Ivanov',
      photoUrl: 'https://media.test/gone.webp',
    });
    const el = fixture.nativeElement as HTMLElement;

    photoOf(el)!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(photoOf(el)).toBeNull();
    expect(el.textContent?.trim()).toBe('GI');

    fixture.componentRef.setInput('photoUrl', 'https://media.test/new.webp');
    await fixture.whenStable();
    expect(photoOf(el)?.getAttribute('src')).toBe(
      'https://media.test/new.webp',
    );
  });
});
