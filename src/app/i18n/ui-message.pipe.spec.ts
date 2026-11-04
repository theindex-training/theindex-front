import { TestBed } from '@angular/core/testing';
import bg from '../../../public/i18n/bg.json';
import en from '../../../public/i18n/en.json';
import { LanguageService } from './language.service';
import { UiMessagePipe } from './ui-message.pipe';

describe('UiMessagePipe', () => {
  let pipe: UiMessagePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [UiMessagePipe] });
    pipe = TestBed.inject(UiMessagePipe);
  });

  it('renders nothing for no message', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('shows API text as is, in any language', () => {
    expect(pipe.transform({ text: 'Plan not found' })).toBe('Plan not found');
    TestBed.inject(LanguageService).use('bg').subscribe();
    expect(pipe.transform({ text: 'Plan not found' })).toBe('Plan not found');
  });

  it('translates a key in the active language and follows a switch', () => {
    const message = { key: 'common.tryAgain' };
    expect(pipe.transform(message)).toBe(en.common.tryAgain);

    TestBed.inject(LanguageService).use('bg').subscribe();

    expect(pipe.transform(message)).toBe(bg.common.tryAgain);
  });

  it('fills in params', () => {
    expect(
      pipe.transform({
        key: 'cashRegister.boughtBy',
        params: { name: 'Ivan' },
      }),
    ).toBe('Bought by Ivan');
  });
});
