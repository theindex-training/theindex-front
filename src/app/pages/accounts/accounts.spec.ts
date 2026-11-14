import { AccountView } from '../../services/accounts.service';
import {
  accountName,
  accountPhone,
  linkFormValues,
  linkPayload,
  matchesAccount,
  profileDifferences,
  sameLinkValue,
  suggestProfiles,
} from './accounts';

function account(extra: Partial<AccountView> = {}): AccountView {
  return {
    id: 'acc-1',
    email: 'ivan@example.com',
    role: 'TRAINEE',
    status: 'ACTIVE',
    createdAt: '2026-11-10T08:00:00.000Z',
    consentAt: '2026-11-10T08:00:00.000Z',
    registration: {
      name: 'Ivan Petrov',
      phone: '+359 88 123 4567',
      gymSubscription: null,
      preferredGym: null,
      instagram: null,
      facebook: null,
      tiktok: null,
    },
    profile: null,
    ...extra,
  };
}

describe('accounts helpers', () => {
  it('names an account by its registration, then its profile, then its email', () => {
    expect(accountName(account())).toBe('Ivan Petrov');
    expect(
      accountName(
        account({
          registration: null,
          profile: {
            type: 'trainer',
            id: 't',
            name: 'Petar',
            nickname: null,
            isActive: true,
          },
        }),
      ),
    ).toBe('Petar');
    expect(accountName(account({ registration: null }))).toBe(
      'ivan@example.com',
    );
    expect(accountPhone(account({ registration: null }))).toBeNull();
  });

  it('searches the email, registered name and phone, and the profile name', () => {
    const a = account({
      profile: {
        type: 'trainee',
        id: 't',
        name: 'Vanyo P.',
        nickname: null,
        isActive: true,
      },
    });
    expect(matchesAccount(a, 'IVAN@')).toBe(true);
    expect(matchesAccount(a, 'petrov')).toBe(true);
    expect(matchesAccount(a, '123 4567')).toBe(true);
    expect(matchesAccount(a, 'vanyo')).toBe(true);
    expect(matchesAccount(a, '  ')).toBe(true);
    expect(matchesAccount(a, 'maria')).toBe(false);
  });

  describe('suggestProfiles', () => {
    const profiles = [
      { id: '1', name: 'Maria Ivanova', nickname: null, phone: null },
      { id: '2', name: 'Ivan Georgiev', nickname: null, phone: null },
      { id: '3', name: 'Ivo', nickname: 'Peter', phone: '0881234567' },
      { id: '4', name: 'Georgi', nickname: 'Petrov', phone: null },
    ];

    it('puts the same phone first, then a shared name word; the rest stay in order', () => {
      const { suggested, others } = suggestProfiles(
        account().registration,
        profiles,
      );
      expect(suggested.map((p) => p.id)).toEqual(['3', '2', '4']);
      expect(others.map((p) => p.id)).toEqual(['1']);
    });

    it('suggests nothing without a registration', () => {
      expect(suggestProfiles(null, profiles)).toEqual({
        suggested: [],
        others: profiles,
      });
    });
  });

  describe('linkFormValues', () => {
    const registration = {
      name: 'Ivan Petrov',
      phone: '0888 123 456',
      gymSubscription: { id: 'gs-1', name: 'MultiSport' },
      preferredGym: { id: 'gym-1', name: 'Center' },
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
    };

    it('a new profile starts from what they registered', () => {
      expect(linkFormValues(registration, 'trainee', null)).toEqual({
        name: 'Ivan Petrov',
        nickname: '',
        contact: {
          phone: '0888 123 456',
          gymSubscriptionId: 'gs-1',
          homeGymId: 'gym-1',
          instagram: '@ivan',
          facebook: null,
          tiktok: null,
        },
      });
    });

    it('an existing profile: what they registered first, the profile fills the gaps', () => {
      expect(
        linkFormValues(registration, 'trainee', {
          id: 't1',
          name: 'Ivan P.',
          nickname: 'Vanko',
          phone: '',
          gymSubscriptionId: null,
          preferredGymId: 'gym-2',
          facebook: 'ivan.fb',
        }),
      ).toEqual({
        name: 'Ivan Petrov',
        nickname: 'Vanko',
        contact: {
          phone: '0888 123 456',
          gymSubscriptionId: 'gs-1',
          homeGymId: 'gym-1',
          instagram: '@ivan',
          facebook: 'ivan.fb',
          tiktok: null,
        },
      });
    });

    it('a trainer has no gym subscription and uses the primary gym', () => {
      const values = linkFormValues(registration, 'trainer', {
        id: 'tr1',
        name: 'Petar',
        nickname: null,
        primaryGymId: 'gym-3',
        preferredGymId: 'ignored',
      });
      expect(values.contact.gymSubscriptionId).toBeNull();
      // The registered preferred gym comes first; the primary gym fills a gap.
      expect(values.contact.homeGymId).toBe('gym-1');
      expect(
        linkFormValues({ ...registration, preferredGym: null }, 'trainer', {
          id: 'tr1',
          name: 'Petar',
          nickname: null,
          primaryGymId: 'gym-3',
        }).contact.homeGymId,
      ).toBe('gym-3');
    });
  });

  describe('profileDifferences', () => {
    const registered = {
      name: 'Ivan Petrov',
      phone: '+359 88 123 4567',
      gymSubscription: { id: 'gs-1', name: 'MultiSport' },
      preferredGym: { id: 'gym-1', name: 'Center' },
      instagram: '@ivan',
      facebook: null,
      tiktok: 'ivan.trains',
    };

    it("gives the profile's value where both have one and they differ", () => {
      expect(
        profileDifferences(registered, 'trainee', {
          id: 't1',
          name: 'Ivan Georgiev',
          nickname: 'Vanko',
          phone: '0899 000 111',
          gymSubscriptionId: 'gs-2',
          preferredGymId: 'gym-2',
          instagram: 'ivan.ig',
          facebook: 'ivan.fb',
          tiktok: null,
        }),
      ).toEqual({
        name: 'Ivan Georgiev',
        phone: '0899 000 111',
        gymSubscriptionId: 'gs-2',
        homeGymId: 'gym-2',
        instagram: 'ivan.ig',
      });
    });

    it('ignores case and spaces in a name, phone separators and "@" before a handle', () => {
      expect(
        profileDifferences(registered, 'trainee', {
          id: 't1',
          name: '  ivan   PETROV ',
          nickname: null,
          phone: '0881234567',
          gymSubscriptionId: 'gs-1',
          preferredGymId: 'gym-1',
          instagram: 'IVAN',
          tiktok: '@ivan.trains/',
        }),
      ).toEqual({});
    });

    it('has none for a new profile, without a registration, or where only one side has a value', () => {
      expect(profileDifferences(registered, 'trainee', null)).toEqual({});
      expect(
        profileDifferences(null, 'trainee', {
          id: 't1',
          name: 'X',
          nickname: null,
        }),
      ).toEqual({});
      expect(
        profileDifferences({ ...registered, phone: '' }, 'trainee', {
          id: 't1',
          name: 'Ivan Petrov',
          nickname: null,
          phone: '0899',
        }),
      ).toEqual({});
    });

    it("compares a trainer's primary gym, never a gym subscription", () => {
      expect(
        profileDifferences(registered, 'trainer', {
          id: 'tr1',
          name: 'Ivan Petrov',
          nickname: null,
          primaryGymId: 'gym-3',
          gymSubscriptionId: 'gs-9',
        }),
      ).toEqual({ homeGymId: 'gym-3' });
    });

    it('sameLinkValue compares as the differences do', () => {
      expect(sameLinkValue('phone', '0888 123 456', '+359888123456')).toBe(
        true,
      );
      expect(sameLinkValue('homeGymId', 'gym-1', 'gym-2')).toBe(false);
      expect(sameLinkValue('instagram', null, '')).toBe(true);
    });
  });

  describe('linkPayload', () => {
    const values = {
      name: ' Ivan Petrov ',
      nickname: '  ',
      contact: {
        phone: '0888 123 456',
        gymSubscriptionId: 'gs-1',
        homeGymId: null,
        instagram: '@ivan',
        facebook: null,
        tiktok: null,
      },
    };

    it('sends every field for a new trainee, the nickname empty as null', () => {
      expect(linkPayload('trainee', null, values)).toEqual({
        profileType: 'trainee',
        name: 'Ivan Petrov',
        nickname: null,
        phone: '0888 123 456',
        gymSubscriptionId: 'gs-1',
        homeGymId: null,
        instagram: '@ivan',
        facebook: null,
        tiktok: null,
      });
    });

    it('names the existing profile, and never sends a gym subscription for a trainer', () => {
      const payload = linkPayload('trainer', 'tr1', values);
      expect(payload).toMatchObject({
        profileType: 'trainer',
        profileId: 'tr1',
      });
      expect(payload).not.toHaveProperty('gymSubscriptionId');
    });
  });
});
