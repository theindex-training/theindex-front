import { buildHttpParams } from './http-params.util';

describe('buildHttpParams', () => {
  it('drops undefined, null and empty strings', () => {
    expect(buildHttpParams({ a: undefined, b: null, c: '' }).keys()).toEqual([]);
  });

  it('keeps false and 0, which the status filters and paging rely on', () => {
    const params = buildHttpParams({ active: false, offset: 0, search: 'ivan', includeInactive: true });

    expect(params.toString()).toBe('active=false&offset=0&search=ivan&includeInactive=true');
  });
});
