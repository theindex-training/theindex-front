import {
  checkSocialProfile,
  displaySocialUrl,
  normalizeSocialProfile,
} from './social-profile.util';

describe('social-profile.util', () => {
  describe('checkSocialProfile', () => {
    it('opens a handle, with or without "@", on its network', () => {
      expect(checkSocialProfile('instagram', ' @ivan.p ')).toEqual({
        url: 'https://www.instagram.com/ivan.p',
        warning: null,
        linkedNetwork: null,
      });
      expect(checkSocialProfile('tiktok', 'ivan_trains').url).toBe(
        'https://www.tiktok.com/@ivan_trains',
      );
      expect(checkSocialProfile('facebook', 'ivan.petrov').url).toBe(
        'https://www.facebook.com/ivan.petrov',
      );
    });

    it('says nothing about an empty value', () => {
      expect(checkSocialProfile('instagram', '  ')).toEqual({
        url: null,
        warning: null,
        linkedNetwork: null,
      });
      expect(checkSocialProfile('tiktok', null).warning).toBeNull();
    });

    it("checks a handle against each network's rules", () => {
      // Instagram: up to 30 of letters, digits, "." and "_", no "." first, last or doubled.
      expect(
        checkSocialProfile('instagram', 'a'.repeat(30)).warning,
      ).toBeNull();
      for (const bad of [
        'a'.repeat(31),
        '.ivan',
        'ivan.',
        'iv..an',
        'Ivan Petrov',
        'ivan-p',
        'javascript:alert(1)',
      ]) {
        expect(checkSocialProfile('instagram', bad).warning).toBe('handle');
      }
      // TikTok: 2 to 24, not ending with ".".
      expect(checkSocialProfile('tiktok', 'iv').warning).toBeNull();
      expect(checkSocialProfile('tiktok', 'i').warning).toBe('handle');
      expect(checkSocialProfile('tiktok', 'a'.repeat(25)).warning).toBe(
        'handle',
      );
      expect(checkSocialProfile('tiktok', 'ivan.').warning).toBe('handle');
      // Facebook: at least 5 letters, digits and periods, no underscores.
      expect(checkSocialProfile('facebook', 'ivanp').warning).toBeNull();
      expect(checkSocialProfile('facebook', 'ivan').warning).toBe('handle');
      expect(checkSocialProfile('facebook', 'ivan_petrov').warning).toBe(
        'handle',
      );
    });

    it("opens a link to the network's profile page", () => {
      expect(
        checkSocialProfile(
          'instagram',
          'https://www.instagram.com/ivan.p/?igsh=abc123',
        ).url,
      ).toBe('https://www.instagram.com/ivan.p');
      expect(checkSocialProfile('instagram', 'instagram.com/ivan.p').url).toBe(
        'https://www.instagram.com/ivan.p',
      );
      expect(
        checkSocialProfile('tiktok', 'https://www.tiktok.com/@ivan?_t=x&_r=1')
          .url,
      ).toBe('https://www.tiktok.com/@ivan');
      expect(
        checkSocialProfile('facebook', 'https://m.facebook.com/ivan.petrov')
          .url,
      ).toBe('https://www.facebook.com/ivan.petrov');
    });

    it('accepts the Facebook and TikTok links that have no handle in them', () => {
      expect(
        checkSocialProfile(
          'facebook',
          'https://www.facebook.com/profile.php?id=100012345&mibextid=x',
        ).url,
      ).toBe('https://www.facebook.com/profile.php?id=100012345');
      expect(
        checkSocialProfile(
          'facebook',
          'https://www.facebook.com/share/1AbCdEf/?mibextid=wwXIfr',
        ).url,
      ).toBe('https://www.facebook.com/share/1AbCdEf/');
      expect(
        checkSocialProfile(
          'facebook',
          'https://www.facebook.com/people/Ivan-Petrov/100012345/',
        ).warning,
      ).toBeNull();
      expect(
        checkSocialProfile('tiktok', 'https://vm.tiktok.com/ZMabc123/').url,
      ).toBe('https://vm.tiktok.com/ZMabc123/');
      expect(
        checkSocialProfile('tiktok', 'https://www.tiktok.com/t/ZTabc/').warning,
      ).toBeNull();
    });

    it('warns about a link to another network, and names it', () => {
      expect(
        checkSocialProfile('facebook', 'https://www.instagram.com/ivan.p/'),
      ).toEqual({
        url: null,
        warning: 'otherNetwork',
        linkedNetwork: 'instagram',
      });
      expect(
        checkSocialProfile('instagram', 'tiktok.com/@ivan').linkedNetwork,
      ).toBe('tiktok');
      expect(
        checkSocialProfile('instagram', 'https://www.facebook.com/share/1Ab/')
          .warning,
      ).toBe('otherNetwork');
    });

    it("warns about a link to the network that isn't a profile", () => {
      for (const [network, link] of [
        ['instagram', 'https://www.instagram.com/p/C1abc/'],
        ['instagram', 'https://www.instagram.com/reel/C1abc/'],
        ['instagram', 'https://www.instagram.com/ivan.p/tagged/'],
        ['instagram', 'instagram.com'],
        ['facebook', 'https://www.facebook.com/groups/crossfit'],
        ['facebook', 'https://www.facebook.com/profile.php'],
        ['tiktok', 'https://www.tiktok.com/@ivan/video/123'],
        ['tiktok', 'https://www.tiktok.com/'],
      ] as const) {
        expect(checkSocialProfile(network, link).warning).toBe('notProfile');
      }
    });

    it('warns about a link to another site', () => {
      expect(
        checkSocialProfile('instagram', 'https://example.org/ivan').warning,
      ).toBe('otherSite');
      expect(checkSocialProfile('tiktok', 'www.example.org').warning).toBe(
        'otherSite',
      );
      // A dotted handle is not read as an address.
      expect(checkSocialProfile('instagram', 'ivan.petrov').warning).toBeNull();
    });
  });

  describe('normalizeSocialProfile', () => {
    it('stores a profile link as its handle, and a bare handle with "@"', () => {
      expect(
        normalizeSocialProfile(
          'instagram',
          ' https://www.instagram.com/ivan.p/?igsh=abc123 ',
        ),
      ).toBe('@ivan.p');
      expect(
        normalizeSocialProfile('tiktok', 'https://www.tiktok.com/@ivan?_t=x'),
      ).toBe('@ivan');
      expect(
        normalizeSocialProfile('facebook', 'facebook.com/ivan.petrov'),
      ).toBe('@ivan.petrov');
      expect(normalizeSocialProfile('instagram', 'ivan')).toBe('@ivan');
      expect(normalizeSocialProfile('instagram', '@ivan')).toBe('@ivan');
    });

    it('keeps the links without a handle, minus their tracking query', () => {
      expect(
        normalizeSocialProfile(
          'facebook',
          'https://web.facebook.com/profile.php?id=100012345&mibextid=x',
        ),
      ).toBe('https://www.facebook.com/profile.php?id=100012345');
      expect(
        normalizeSocialProfile(
          'facebook',
          'https://www.facebook.com/share/1AbCdEf/?mibextid=wwXIfr',
        ),
      ).toBe('https://www.facebook.com/share/1AbCdEf/');
    });

    it("only trims what doesn't look right, so nothing typed is lost", () => {
      expect(
        normalizeSocialProfile('facebook', ' https://www.instagram.com/ivan '),
      ).toBe('https://www.instagram.com/ivan');
      expect(
        normalizeSocialProfile('instagram', 'https://www.instagram.com/p/C1/'),
      ).toBe('https://www.instagram.com/p/C1/');
      expect(normalizeSocialProfile('instagram', ' Ivan Petrov ')).toBe(
        'Ivan Petrov',
      );
      expect(normalizeSocialProfile('tiktok', '   ')).toBe('');
      expect(normalizeSocialProfile('tiktok', null)).toBe('');
    });
  });

  it('shows a link without its scheme, "www." or trailing slash', () => {
    expect(displaySocialUrl('https://www.instagram.com/ivan.p')).toBe(
      'instagram.com/ivan.p',
    );
    expect(displaySocialUrl('https://vm.tiktok.com/ZMabc/')).toBe(
      'vm.tiktok.com/ZMabc',
    );
  });
});
