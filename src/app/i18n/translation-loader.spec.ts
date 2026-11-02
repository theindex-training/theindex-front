import bg from '../../../public/i18n/bg.json';
import en from '../../../public/i18n/en.json';
import { BundledTranslationLoader } from './translation-loader';

describe('BundledTranslationLoader', () => {
  const loader = new BundledTranslationLoader();

  it('loads English for "en"', async () => {
    expect(await loader.getTranslation('en')).toEqual(en);
  });

  it.each(['bg', 'de', ''])('loads Bulgarian for %j', async lang => {
    expect(await loader.getTranslation(lang)).toEqual(bg);
  });
});
