import { TestBed } from '@angular/core/testing';
import bg from '../../../public/i18n/bg.json';
import en from '../../../public/i18n/en.json';
import { EnumLabelPipe } from './enum-label.pipe';
import { enumLabelKey, isKnownEnum } from './enum-labels';
import { LanguageService } from './language.service';

describe('EnumLabelPipe', () => {
  let pipe: EnumLabelPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EnumLabelPipe] });
    pipe = TestBed.inject(EnumLabelPipe);
  });

  it('translates a known API value, whatever its case', () => {
    expect(pipe.transform('PUNCH', 'planType')).toBe(en.enums.planType.PUNCH);
    expect(pipe.transform('punch', 'planType')).toBe(en.enums.planType.PUNCH);
  });

  it('shows an unknown value as the API sent it, never a raw key', () => {
    expect(pipe.transform('FAMILY', 'planType')).toBe('FAMILY');
  });

  it('renders nothing for an empty value', () => {
    expect(pipe.transform(null, 'role')).toBe('');
    expect(pipe.transform(undefined, 'role')).toBe('');
    expect(pipe.transform('', 'role')).toBe('');
  });

  it('follows a language switch', () => {
    TestBed.inject(LanguageService).use('bg').subscribe();

    expect(pipe.transform('ADMIN', 'role')).toBe(bg.enums.role.ADMIN);
  });
});

describe('enum label helpers', () => {
  it('builds the key with the value upper-cased', () => {
    expect(enumLabelKey('paymentStatus', 'paid')).toBe('enums.paymentStatus.PAID');
  });

  it('knows the API values of each group, case-insensitively', () => {
    expect(isKnownEnum('settlementStatus', 'final')).toBe(true);
    expect(isKnownEnum('settlementStatus', 'ARCHIVED')).toBe(false);
    expect(isKnownEnum('planType', 'ACTIVE')).toBe(false);
  });
});
