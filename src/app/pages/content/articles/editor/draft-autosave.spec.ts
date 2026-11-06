import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiError } from '../../../../../testing/dom';
import {
  Article,
  ArticlesService,
} from '../../../../services/articles.service';
import { DraftAutosave, DraftField } from './draft-autosave';

const DELAY = 2000;
const article = (draftRevision: number) => ({ draftRevision }) as Article;

describe('DraftAutosave', () => {
  let http: HttpTestingController;
  let autosave: DraftAutosave;
  /** What the page would send for each field right now; `undefined` = the field has an error. */
  let values: Partial<Record<DraftField, unknown>>;
  let saved: number[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const articles = TestBed.inject(ArticlesService);
    values = { title: 'Клек', excerpt: null, categoryIds: ['c1'] };
    saved = [];
    autosave = new DraftAutosave({
      revision: 4,
      delayMs: DELAY,
      collect: (fields) => {
        const changes: Record<string, unknown> = {};
        const invalid: DraftField[] = [];
        for (const field of fields) {
          if (values[field] === undefined) invalid.push(field);
          else changes[field] = values[field];
        }
        return Promise.resolve({
          changes,
          invalid,
        });
      },
      send: (payload) => articles.saveDraft('a1', payload),
      saved: (result) => saved.push(result.draftRevision),
    });
  });

  afterEach(() => {
    autosave.stop();
    vi.useRealTimers();
    http.verify();
  });

  const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
  const pending = (): TestRequest[] =>
    http.match({ method: 'PATCH', url: '/api/articles/a1/draft' });
  const bodyOf = (req: TestRequest) =>
    JSON.parse(req.request.serializeBody() as string) as Record<
      string,
      unknown
    >;

  it('waits 2 seconds after the last change, then sends only the changed fields and the revision', async () => {
    autosave.change('title');
    await wait(1500);
    autosave.change('excerpt');
    await wait(1999);
    expect(pending()).toHaveLength(0);
    expect(autosave.status()).toBe('pending');
    expect(autosave.hasUnsavedChanges).toBe(true);

    await wait(1);
    const [req] = pending();
    expect(bodyOf(req)).toEqual({
      title: 'Клек',
      excerpt: null,
      baseRevision: 4,
    });
    expect(autosave.status()).toBe('saving');

    req.flush(article(5));
    await wait(0);
    expect(autosave.status()).toBe('saved');
    expect(autosave.revision).toBe(5);
    expect(saved).toEqual([5]);
    expect(autosave.hasUnsavedChanges).toBe(false);
  });

  it('bases each save on the revision the last one returned', async () => {
    autosave.change('title');
    await wait(DELAY);
    pending()[0].flush(article(5));
    await wait(0);

    values['categoryIds'] = ['c1', 'c2'];
    autosave.change('categoryIds');
    await wait(DELAY);
    const [req] = pending();
    expect(bodyOf(req)).toEqual({ categoryIds: ['c1', 'c2'], baseRevision: 5 });
    req.flush(article(6));
    await wait(0);
  });

  it('sends one request at a time: a change made while saving goes with the next save', async () => {
    autosave.change('title');
    await wait(DELAY);
    const [first] = pending();

    values['title'] = 'Клек с пауза';
    autosave.change('title');
    await wait(DELAY);
    expect(pending()).toHaveLength(0);
    expect(autosave.status()).toBe('saving');

    // The delay ran out meanwhile, so the next save follows the first one at once.
    first.flush(article(5));
    await wait(0);
    const [second] = pending();
    expect(bodyOf(second)).toEqual({ title: 'Клек с пауза', baseRevision: 5 });
    second.flush(article(6));
    await wait(0);
    expect(autosave.status()).toBe('saved');
  });

  it('waits for the delay again when the change came after the save started', async () => {
    autosave.change('title');
    await wait(DELAY);
    const [first] = pending();
    autosave.change('excerpt');

    first.flush(article(5));
    await wait(0);
    expect(autosave.status()).toBe('pending');
    expect(pending()).toHaveLength(0);
    await wait(DELAY);
    const [second] = pending();
    expect(bodyOf(second)).toEqual({ excerpt: null, baseRevision: 5 });
    second.flush(article(6));
    await wait(0);
  });

  it('saves the valid fields and keeps a field with an error until it is fixed', async () => {
    values['excerpt'] = undefined;
    autosave.change('title');
    autosave.change('excerpt');
    await wait(DELAY);

    const [req] = pending();
    expect(bodyOf(req)).toEqual({ title: 'Клек', baseRevision: 4 });
    req.flush(article(5));
    await wait(0);
    expect(autosave.status()).toBe('invalid');
    expect(autosave.hasUnsavedChanges).toBe(true);

    // Nothing more is sent until the field changes again.
    await wait(DELAY * 3);
    expect(pending()).toHaveLength(0);

    values['excerpt'] = 'Кратко';
    autosave.change('excerpt');
    await wait(DELAY);
    const [fixed] = pending();
    expect(bodyOf(fixed)).toEqual({ excerpt: 'Кратко', baseRevision: 5 });
    fixed.flush(article(6));
    await wait(0);
    expect(autosave.status()).toBe('saved');
  });

  it('sends nothing when every changed field has an error', async () => {
    values['title'] = undefined;
    autosave.change('title');
    await wait(DELAY);

    expect(pending()).toHaveLength(0);
    expect(autosave.status()).toBe('invalid');
    expect(await autosave.save()).toBe(false);
  });

  it('keeps the changes after a failed save and sends them again on "Try again"', async () => {
    autosave.change('title');
    await wait(DELAY);
    const failure = apiError(undefined, 500);
    pending()[0].flush(failure.body, failure.options);
    await wait(0);

    expect(autosave.status()).toBe('error');
    expect(autosave.error()).toEqual({
      key: 'content.articles.editor.save.error',
      params: undefined,
    });
    expect(autosave.hasUnsavedChanges).toBe(true);

    const result = autosave.save();
    await wait(0);
    const [retry] = pending();
    expect(bodyOf(retry)).toEqual({ title: 'Клек', baseRevision: 4 });
    retry.flush(article(5));
    expect(await result).toBe(true);
    expect(autosave.status()).toBe('saved');
  });

  it('stops for good on a 409 and shows the API message, so a stale tab never overwrites newer work', async () => {
    autosave.change('title');
    await wait(DELAY);
    pending()[0].flush(
      {
        statusCode: 409,
        message: 'The article was changed in another tab.',
        currentRevision: 9,
      },
      { status: 409, statusText: 'Conflict' },
    );
    await wait(0);

    expect(autosave.status()).toBe('conflict');
    expect(autosave.error()).toEqual({
      text: 'The article was changed in another tab.',
    });
    autosave.change('excerpt');
    await wait(DELAY);
    expect(await autosave.save()).toBe(false);
    expect(pending()).toHaveLength(0);
    expect(autosave.hasUnsavedChanges).toBe(true);
  });

  it('saves at once on save() (leaving the page), without waiting for the delay', async () => {
    autosave.change('title');
    const result = autosave.save();
    await wait(0);
    pending()[0].flush(article(5));

    expect(await result).toBe(true);
    await wait(DELAY);
    expect(pending()).toHaveLength(0);
  });

  it('answers save() with true at once when nothing changed', async () => {
    expect(await autosave.save()).toBe(true);
    expect(pending()).toHaveLength(0);
  });
});
