import { contactForm, contactValues, fillContactForm } from './contact-form';

describe('contact-form', () => {
  it('sends trimmed values, and empty ones as null', () => {
    const form = contactForm({ phoneRequired: false });
    form.setValue({
      phone: ' 0888 123 456 ',
      gymSubscriptionId: 'gs-1',
      homeGymId: '',
      instagram: ' @ivan ',
      facebook: '   ',
      tiktok: '',
    });

    expect(contactValues(form)).toEqual({
      phone: '0888 123 456',
      gymSubscriptionId: 'gs-1',
      homeGymId: null,
      instagram: '@ivan',
      facebook: null,
      tiktok: null,
    });
  });

  it('requires the phone only when asked, and always checks its form', () => {
    const required = contactForm({ phoneRequired: true });
    expect(required.controls.phone.hasError('required')).toBe(true);
    required.controls.phone.setValue('12');
    expect(required.controls.phone.hasError('phone')).toBe(true);
    required.controls.phone.setValue('+359 88 123 4567');
    expect(required.valid).toBe(true);

    const optional = contactForm({ phoneRequired: false });
    expect(optional.valid).toBe(true);
    optional.controls.phone.setValue('call me');
    expect(optional.controls.phone.hasError('phone')).toBe(true);
  });

  it('limits social profiles to 200 characters', () => {
    const form = contactForm({ phoneRequired: false });
    form.controls.tiktok.setValue('x'.repeat(201));
    expect(form.controls.tiktok.hasError('maxlength')).toBe(true);
  });

  it('fills from stored values, null as empty', () => {
    const form = contactForm({ phoneRequired: false });
    fillContactForm(form, {
      phone: '0888',
      homeGymId: 'gym-1',
      instagram: null,
    });
    expect(form.getRawValue()).toEqual({
      phone: '0888',
      gymSubscriptionId: '',
      homeGymId: 'gym-1',
      instagram: '',
      facebook: '',
      tiktok: '',
    });
  });
});
