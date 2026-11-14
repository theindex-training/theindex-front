import { FormControl } from '@angular/forms';
import { optionalText, phoneValidator, socialProfileUrl } from './contact.util';

describe('contact.util', () => {
  describe('phoneValidator', () => {
    const check = (value: string | null) =>
      phoneValidator()(new FormControl(value));

    it('accepts the forms the API accepts, and an empty value', () => {
      for (const phone of [
        '0888123456',
        '+359 88 123 4567',
        '0888/123-456',
        '(02) 987 65 43',
        '',
        null,
      ]) {
        expect(check(phone)).toBeNull();
      }
    });

    it('rejects too few or too many digits, letters and a second +', () => {
      for (const phone of [
        '12345',
        'call me',
        '++359888123456',
        '1234567890123456',
        '0888 123 abc',
      ]) {
        expect(check(phone)).toEqual({ phone: true });
      }
    });

    it('rejects more than 30 characters', () => {
      expect(check('+359 (88) 123 - 456 - 789 / 01 23')).toEqual({
        phone: true,
      });
    });
  });

  it('optionalText trims and turns empty into null', () => {
    expect(optionalText('  @ivan ')).toBe('@ivan');
    expect(optionalText('   ')).toBeNull();
    expect(optionalText(null)).toBeNull();
    expect(optionalText(undefined)).toBeNull();
  });

  describe('socialProfileUrl', () => {
    it('opens a handle on its network', () => {
      expect(socialProfileUrl('instagram', '@ivan.p')).toBe(
        'https://www.instagram.com/ivan.p',
      );
      expect(socialProfileUrl('tiktok', 'ivan_trains')).toBe(
        'https://www.tiktok.com/@ivan_trains',
      );
      expect(socialProfileUrl('facebook', 'ivan.petrov')).toBe(
        'https://www.facebook.com/ivan.petrov',
      );
    });

    it('keeps an http(s) link as it is', () => {
      expect(
        socialProfileUrl('facebook', ' https://facebook.com/profile.php?id=1 '),
      ).toBe('https://facebook.com/profile.php?id=1');
    });

    it('gives nothing for empty text, a handle with spaces or another scheme', () => {
      expect(socialProfileUrl('instagram', '')).toBeNull();
      expect(socialProfileUrl('instagram', null)).toBeNull();
      expect(socialProfileUrl('instagram', 'Ivan Petrov')).toBeNull();
      expect(socialProfileUrl('instagram', 'javascript:alert(1)')).toBeNull();
    });
  });
});
