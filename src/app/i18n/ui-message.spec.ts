import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage, i18nMessage } from './ui-message';

const httpError = (body: unknown) => new HttpErrorResponse({ error: body, status: 400 });

describe('apiErrorMessage', () => {
  it("uses the API's message when it sent a string", () => {
    expect(apiErrorMessage(httpError({ message: 'Plan not found' }), 'plans.errors.load')).toEqual({
      text: 'Plan not found'
    });
  });

  it('joins a list of validation messages', () => {
    expect(apiErrorMessage(httpError({ message: ['name is too short', 'price must be >= 0'] }), 'x.y')).toEqual({
      text: 'name is too short, price must be >= 0'
    });
  });

  it.each([
    ['a blank message', { message: '   ' }],
    ['an empty list', { message: [] }],
    ['a non-string message', { message: 42 }],
    ['no body', null],
    ['a plain text body', 'Bad Gateway']
  ])('falls back to the translation key for %s', (_, body) => {
    expect(apiErrorMessage(httpError(body), 'plans.errors.load', { id: 'p1' })).toEqual({
      key: 'plans.errors.load',
      params: { id: 'p1' }
    });
  });

  it('falls back for an error that is not an HTTP error at all', () => {
    expect(apiErrorMessage(null, 'common.error')).toEqual({ key: 'common.error', params: undefined });
    expect(apiErrorMessage(new Error('boom'), 'common.error')).toEqual({ key: 'common.error', params: undefined });
  });
});

describe('i18nMessage', () => {
  it('stores a key and its params for translation at render time', () => {
    expect(i18nMessage('trainees.list.count', { shown: 1, total: 2 })).toEqual({
      key: 'trainees.list.count',
      params: { shown: 1, total: 2 }
    });
  });
});
