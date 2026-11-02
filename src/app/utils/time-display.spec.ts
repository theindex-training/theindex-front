import { formatTimeWithoutSeconds } from './time-display';

describe('formatTimeWithoutSeconds', () => {
  it.each([
    ['18:30:00', '18:30'],
    ['08:05', '08:05'],
    ['8:5', '08:05'],
    ['8:05:59', '08:05']
  ])('%s → %s', (input, expected) => {
    expect(formatTimeWithoutSeconds(input)).toBe(expected);
  });

  it('returns a value without a colon unchanged', () => {
    expect(formatTimeWithoutSeconds('1830')).toBe('1830');
    expect(formatTimeWithoutSeconds('')).toBe('');
  });
});
