import { AvatarComponent } from './avatar.component';

describe('AvatarComponent initials', () => {
  const initials = (name: string) => Object.assign(new AvatarComponent(), { name }).initials;

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
