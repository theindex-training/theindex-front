import { displayValue } from './display.util';

describe('displayValue', () => {
  it('trims the value', () => {
    expect(displayValue('  Vanko ')).toBe('Vanko');
  });

  it.each([null, undefined, '', '   '])('shows the dash for %j', value => {
    expect(displayValue(value)).toBe('—');
  });

  it('accepts a custom fallback', () => {
    expect(displayValue(null, 'n/a')).toBe('n/a');
  });
});
