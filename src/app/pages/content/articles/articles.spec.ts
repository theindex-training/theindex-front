import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import bg from '../../../../../public/i18n/bg.json';
import en from '../../../../../public/i18n/en.json';
import { firstValueFrom } from 'rxjs';
import { LanguageService } from '../../../i18n/language.service';
import { PageDriver, apiError, driver } from '../../../../testing/dom';
import { signInAs } from '../../../../testing/jwt';
import { Article, ArticleSummary } from '../../../services/articles.service';
import { Media } from '../../../services/media.service';
import { ArticleCreateComponent } from './article-create.component';
import {
  AUTOSAVE_DELAY,
  ArticleEditorComponent,
} from './article-editor.component';
import { ArticlesComponent } from './articles.component';
import { leaveEditorGuard } from './leave-editor.guard';

/** The articles list, "New article" and the editor (decision record item 10). */

const t = en.content.articles;
const CATEGORIES = [
  {
    id: 'c1',
    language: 'bg',
    name: 'Хранене',
    slug: 'hranene',
    description: null,
    sortOrder: 0,
  },
  {
    id: 'c2',
    language: 'bg',
    name: 'Техника',
    slug: 'tehnika',
    description: null,
    sortOrder: 1,
  },
];

const summary = (
  id: string,
  title: string,
  overrides: Partial<ArticleSummary> = {},
): ArticleSummary => ({
  id,
  status: 'DRAFT',
  slug: null,
  title,
  publishedTitle: null,
  categoryIds: [],
  featuredMediaId: null,
  hasUnpublishedChanges: true,
  draftUpdatedAt: '2026-11-06T10:00:00Z',
  firstPublishedAt: null,
  lastPublishedAt: null,
  createdAt: '2026-11-06T09:00:00Z',
  updatedAt: '2026-11-06T10:00:00Z',
  ...overrides,
});

const DRAFT: Article = {
  id: 'a1',
  language: 'bg',
  status: 'DRAFT',
  slug: null,
  published: null,
  draft: {
    title: 'Как да започнем',
    excerpt: 'Първи стъпки.',
    content: {
      blocks: [
        {
          id: 'p1',
          type: 'paragraph',
          data: { text: 'Добре дошли в залата.' },
        },
      ],
    },
    featuredMediaId: 'm1',
    categoryIds: ['c2'],
    seoTitle: null,
    seoDescription: null,
    slug: 'parvi-stapki',
  },
  draftRevision: 3,
  draftUpdatedAt: '2026-11-06T10:00:00Z',
  hasUnpublishedChanges: true,
  firstPublishedAt: null,
  lastPublishedAt: null,
  unpublishedAt: null,
  createdByAccountId: 'acc-1',
  updatedByAccountId: 'acc-1',
  createdAt: '2026-11-06T09:00:00Z',
  updatedAt: '2026-11-06T10:00:00Z',
};

const PUBLISHED: Article = {
  ...DRAFT,
  status: 'PUBLISHED',
  slug: 'kak-da-zapochnem',
  draft: { ...DRAFT.draft, slug: null, featuredMediaId: null },
  firstPublishedAt: '2026-11-01T10:00:00Z',
  lastPublishedAt: '2026-11-01T10:00:00Z',
  published: {
    title: 'Как да започнем',
    excerpt: null,
    content: DRAFT.draft.content,
    featuredMediaId: null,
    seoTitle: null,
    seoDescription: null,
    categoryIds: ['c2'],
  },
};

const image = (id: string, altText: string): Media => ({
  id,
  altText,
  width: 1600,
  height: 1067,
  url: `https://media.test/${id}/master.jpg`,
  variants: [
    { url: `https://media.test/${id}/480.webp`, width: 480, height: 320 },
  ],
  ogImage: { url: `https://media.test/${id}/og.jpg`, width: 1200, height: 630 },
  originalFilename: null,
  sizeBytes: 1000,
  uploadedByAccountId: null,
  createdAt: '2026-11-06T10:00:00Z',
  updatedAt: '2026-11-06T10:00:00Z',
});

const page = (items: unknown[], total = items.length, pageNumber = 1) => ({
  items,
  total,
  page: pageNumber,
  pageSize: 20,
});

describe('article pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let ui: PageDriver;
  const originalMatchMedia = window.matchMedia;
  const dialogProto = HTMLDialogElement.prototype as unknown as Record<
    string,
    unknown
  >;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('ADMIN');
    // jsdom has no matchMedia (Editor.js asks for it) and no modal dialogs.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    dialogProto['showModal'] = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    dialogProto['close'] = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTOSAVE_DELAY, useValue: 20 },
        provideRouter([
          { path: 'content/articles/new', component: ArticleCreateComponent },
          {
            path: 'content/articles/:id',
            component: ArticleEditorComponent,
            canDeactivate: [leaveEditorGuard],
          },
          { path: 'content/articles', component: ArticlesComponent },
          { path: 'missing-id', component: ArticleEditorComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    window.matchMedia = originalMatchMedia;
    delete dialogProto['showModal'];
    delete dialogProto['close'];
    vi.restoreAllMocks();
  });

  async function open(url: string) {
    await harness.navigateByUrl(url);
    ui = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await ui.settle();
  }

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  const button = (label: string) =>
    ui
      .queryAll<HTMLButtonElement>('button')
      .find((b) => b.textContent?.trim() === label);
  const clickButton = async (label: string) => {
    const target = button(label);
    if (!target) throw new Error(`No button "${label}"`);
    target.click();
    await ui.settle();
  };
  const bodyOf = (req: TestRequest) =>
    JSON.parse(req.request.serializeBody() as string) as Record<
      string,
      unknown
    >;
  const drafts = () =>
    http.match({ method: 'PATCH', url: '/api/articles/a1/draft' });

  describe('list', () => {
    const LIST = '/api/articles';
    const expectList = (params: string) =>
      http.expectOne(
        (req) => req.method === 'GET' && req.urlWithParams === LIST + params,
      );

    async function openList(items: unknown[], total = items.length) {
      await open('/content/articles');
      expectList('?page=1&pageSize=20').flush(page(items, total));
      http.expectOne('/api/article-categories').flush(CATEGORIES);
      await ui.settle();
    }

    it('shows the rows with their status, categories and a link to the editor', async () => {
      await openList([
        summary('a1', 'Как да започнем', { categoryIds: ['c2', 'c1'] }),
        summary('a2', 'Клековете', {
          status: 'PUBLISHED',
          slug: 'klekovete',
          hasUnpublishedChanges: true,
        }),
        summary('a3', '   ', {
          status: 'UNPUBLISHED',
          hasUnpublishedChanges: false,
        }),
      ]);

      const rows = ui.queryAll('tbody tr');
      expect(
        rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim()),
      ).toEqual([
        expect.stringContaining('Как да започнем Draft Техника, Хранене'),
        expect.stringContaining(
          `Клековете Published ${t.unpublishedChanges} —`,
        ),
        expect.stringContaining(`${t.untitled} Unpublished —`),
      ]);
      expect(
        ui.query<HTMLAnchorElement>('tbody .cell-link')!.getAttribute('href'),
      ).toBe('/content/articles/a1');
      expect(ui.query('[data-testid="list-count"]')!.textContent?.trim()).toBe(
        '3 of 3 articles',
      );
    });

    it('asks the API for a status and shows "Show all" when none has it', async () => {
      await openList([summary('a1', 'Как да започнем')]);

      ui.queryAll<HTMLInputElement>('input[type="radio"]')[1].click();
      await ui.settle();
      expectList('?status=DRAFT&page=1&pageSize=20').flush(page([]));
      await ui.settle();
      expect(ui.text()).toContain(t.list.emptyFilteredTitle);

      await clickButton(en.common.showAll);
      expectList('?page=1&pageSize=20').flush(page([summary('a1', 'Как')]));
      await ui.settle();
      expect(ui.queryAll('tbody tr')).toHaveLength(1);
    });

    it('searches the API after a pause in typing, and "Clear search" shows all again', async () => {
      await openList([summary('a1', 'Как да започнем')]);

      await ui.type('input[type="search"]', 'кле');
      await ui.type('input[type="search"]', 'клек');
      expect(http.match((req) => req.url === LIST)).toHaveLength(0);
      await sleep(350);
      expectList(
        `?search=${encodeURIComponent('клек')}&page=1&pageSize=20`,
      ).flush(page([]));
      await ui.settle();
      expect(ui.text()).toContain('No article title contains “клек”.');

      await clickButton(en.common.clearSearch);
      expectList('?page=1&pageSize=20').flush(page([summary('a1', 'Как')]));
      await ui.settle();
      expect(ui.queryAll('tbody tr')).toHaveLength(1);
    });

    it('gives "Show more" back when the filter changes while it is loading', async () => {
      await openList([summary('a1', 'Първа')], 2);

      await clickButton(t.list.showMore);
      const more = expectList('?page=2&pageSize=20');
      ui.queryAll<HTMLInputElement>('input[type="radio"]')[1].click();
      await ui.settle();
      expect(more.cancelled).toBe(true);
      expectList('?status=DRAFT&page=1&pageSize=20').flush(
        page([summary('a1', 'Първа')], 2),
      );
      await ui.settle();

      expect(button(t.list.showMore)?.disabled).toBe(false);
      expect(button(t.list.showMore)?.textContent?.trim()).toBe(
        t.list.showMore,
      );
    });

    it('loads the next page on "Show more" and adds it to the rows', async () => {
      await openList([summary('a1', 'Първа')], 2);

      await clickButton(t.list.showMore);
      expectList('?page=2&pageSize=20').flush(
        page([summary('a2', 'Втора')], 2, 2),
      );
      await ui.settle();
      expect(ui.queryAll('tbody tr')).toHaveLength(2);
      expect(button(t.list.showMore)).toBeUndefined();
    });

    it('offers "New article" when there are none', async () => {
      await openList([]);
      expect(ui.text()).toContain(t.list.emptyTitle);
      expect(
        ui
          .queryAll<HTMLAnchorElement>('app-empty-state a')
          .map((a) => a.getAttribute('href')),
      ).toEqual(['/content/articles/new']);
      expect(ui.query('[data-testid="list-count"]')).toBeNull();
    });

    it('shows a failed load with "Try again", which loads again', async () => {
      await open('/content/articles');
      const failure = apiError(undefined, 500);
      expectList('?page=1&pageSize=20').flush(failure.body, failure.options);
      http.expectOne('/api/article-categories').flush(CATEGORIES);
      await ui.settle();
      expect(ui.alert()).toContain(t.list.loadErrorMessage);
      await clickButton(en.common.tryAgain);
      expectList('?page=1&pageSize=20').flush(page([]));
      await ui.settle();
    });
  });

  describe('new article', () => {
    it('sends nothing without a title', async () => {
      await open('/content/articles/new');
      await ui.submit();

      expect(http.match(() => true)).toHaveLength(0);
      expect(ui.text()).toContain(t.create.titleError);
    });

    it('creates the draft with the trimmed title and opens it in the editor', async () => {
      await open('/content/articles/new');
      await ui.type('#article-new-title', '  Как да започнем  ');
      await ui.submit();

      const req = http.expectOne('/api/articles');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ title: 'Как да започнем' });
      req.flush({ ...DRAFT, id: 'a-new' });
      await ui.settle();

      expect(router.url).toBe('/content/articles/a-new');
      http.expectOne('/api/articles/a-new');
      http.expectOne('/api/article-categories');
    });

    it('shows the API error and gives the button back', async () => {
      await open('/content/articles/new');
      await ui.type('#article-new-title', 'Как');
      await ui.submit();
      const failure = apiError('title must not be empty');
      http.expectOne('/api/articles').flush(failure.body, failure.options);
      await ui.settle();

      expect(ui.alert()).toBe('title must not be empty');
      expect(button(t.create.submit)?.disabled).toBe(false);
      expect(router.url).toBe('/content/articles/new');
    });
  });

  describe('editor', () => {
    async function openEditor(article: Article = DRAFT) {
      await open(`/content/articles/${article.id}`);
      http.expectOne(`/api/articles/${article.id}`).flush(article);
      http.expectOne('/api/article-categories').flush(CATEGORIES);
      await ui.settle();
      if (article.draft.featuredMediaId) {
        http
          .expectOne(`/api/media/${article.draft.featuredMediaId}`)
          .flush(image(article.draft.featuredMediaId, 'Щанга на земята'));
      }
      // Editor.js renders asynchronously.
      await sleep(50);
      await ui.settle();
    }

    const value = (selector: string) =>
      ui.query<HTMLInputElement | HTMLTextAreaElement>(selector)!.value;
    const status = () =>
      ui.query('[data-testid="article-save-status"]')?.textContent?.trim();
    const checkbox = (name: string) =>
      ui
        .queryAll<HTMLLabelElement>('label.form-field--check')
        .find((label) => label.textContent?.trim() === name)!
        .querySelector('input')!;

    /** Waits for the autosave delay (20 ms here) and returns the PATCH it sent. */
    async function nextSave(): Promise<TestRequest> {
      await sleep(40);
      await ui.settle();
      const [req] = drafts();
      if (!req) throw new Error('No autosave was sent');
      return req;
    }

    it('fills the title, the body and the settings from the draft', async () => {
      await openEditor();

      expect(value('#article-title')).toBe('Как да започнем');
      expect(ui.query('[data-testid="article-body"]')!.textContent).toContain(
        'Добре дошли в залата.',
      );
      expect(value('#article-slug')).toBe('parvi-stapki');
      expect(value('#article-excerpt')).toBe('Първи стъпки.');
      expect(value('#article-seo-title')).toBe('');
      expect(checkbox('Техника').checked).toBe(true);
      expect(checkbox('Хранене').checked).toBe(false);
      expect(
        ui.query<HTMLImageElement>('[data-testid="article-featured-image"]')!
          .alt,
      ).toBe('Щанга на земята');
      expect(ui.query('[data-testid="article-status"]')!.textContent).toContain(
        'Draft',
      );
      expect(ui.text()).toContain(t.settings.addressLater);
      expect(status()).toBe(t.editor.save.saved);
    });

    it('autosaves only the changed text fields, trimmed, after the delay', async () => {
      await openEditor();

      await ui.type('#article-title', 'Как да започнем с КросФит ');
      await ui.type('#article-excerpt', '   ');
      expect(status()).toBe(t.editor.save.pending);
      const req = await nextSave();

      expect(bodyOf(req)).toEqual({
        baseRevision: 3,
        title: 'Как да започнем с КросФит',
        excerpt: null,
      });
      expect(status()).toBe(t.editor.save.saving);
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
      expect(status()).toBe(t.editor.save.saved);

      // The next save is based on the revision the last one returned.
      await ui.type('#article-seo-title', 'Първа тренировка');
      const next = await nextSave();
      expect(bodyOf(next)).toEqual({
        baseRevision: 4,
        seoTitle: 'Първа тренировка',
      });
      next.flush({ ...DRAFT, draftRevision: 5 });
      await ui.settle();
    });

    it('autosaves the body as stored blocks after an edit', async () => {
      await openEditor();
      // Editor.js watches a block for edits once the browser is idle after rendering it.
      await sleep(300);

      const paragraph = ui.query('[data-testid="article-body"] .ce-paragraph')!;
      paragraph.innerHTML = 'Добре дошли в <b>залата</b>!';
      // Editor.js batches its change events for 400 ms, then the autosave delay runs.
      await sleep(600);
      const [req] = drafts();

      expect(bodyOf(req)).toEqual({
        baseRevision: 3,
        content: {
          time: expect.any(Number),
          version: expect.any(String),
          blocks: [
            {
              id: 'p1',
              type: 'paragraph',
              data: { text: 'Добре дошли в <b>залата</b>!' },
            },
          ],
        },
      });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
    });

    it('shows image and video blocks from their ids, and saves them back unchanged', async () => {
      const withMedia: Article = {
        ...DRAFT,
        draft: {
          ...DRAFT.draft,
          featuredMediaId: null,
          content: {
            blocks: [
              { id: 'p1', type: 'paragraph', data: { text: 'Вижте:' } },
              {
                id: 'i1',
                type: 'image',
                data: { mediaId: 'm5', caption: 'Правилна <i>стойка</i>' },
              },
              {
                id: 'v1',
                type: 'embed',
                data: {
                  service: 'youtube',
                  videoId: 'dQw4w9WgXcQ',
                  caption: '',
                },
              },
            ],
          },
        },
      };
      await openEditor(withMedia);
      http.expectOne('/api/media/m5').flush(image('m5', 'Клек с щанга'));
      await sleep(300);
      await ui.settle();

      const body = ui.query('[data-testid="article-body"]')!;
      expect(
        Array.from(body.querySelectorAll('img')).map((img) => [
          img.alt,
          img.getAttribute('src'),
        ]),
      ).toEqual([
        ['Клек с щанга', 'https://media.test/m5/480.webp'],
        [
          en.content.articles.blocks.videoThumbnail,
          'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        ],
      ]);
      expect(body.querySelector('a')!.getAttribute('href')).toBe(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      );

      body.querySelector('.ce-paragraph')!.innerHTML = 'Вижте това:';
      await sleep(600);
      const [req] = drafts();
      expect((bodyOf(req)['content'] as { blocks: unknown[] }).blocks).toEqual([
        { id: 'p1', type: 'paragraph', data: { text: 'Вижте това:' } },
        withMedia.draft.content.blocks[1],
        withMedia.draft.content.blocks[2],
      ]);
      req.flush({ ...withMedia, draftRevision: 4 });
      await ui.settle();
    });

    it('rebuilds the editor in the new language, keeping the text', async () => {
      await openEditor();
      const body = () => ui.query('[data-testid="article-body"]')!;
      body().querySelector('.ce-paragraph')!.innerHTML = 'Незапазен текст';

      await firstValueFrom(TestBed.inject(LanguageService).use('bg'));
      await ui.settle();
      await sleep(100);

      expect(body().querySelectorAll('.ce-block')).toHaveLength(1);
      expect(body().textContent).toContain('Незапазен текст');
      expect(
        body()
          .querySelector('.ce-paragraph')!
          .getAttribute('data-placeholder-active'),
      ).toBe(bg.content.articles.blocks.placeholder);
      await sleep(600);
      http.match({ method: 'PATCH' }).forEach((req) => req.flush(DRAFT));
    });

    it('keeps a field that is too long out of the save until it is fixed', async () => {
      await openEditor();

      await ui.type('#article-seo-description', 'а'.repeat(161));
      await ui.type('#article-title', 'Ново');
      const req = await nextSave();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, title: 'Ново' });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();

      expect(status()).toBe(t.editor.save.invalid);
      expect(ui.text()).toContain(t.fields.seoDescriptionError);
      await ui.type('#article-seo-description', 'Кратко.');
      const fixed = await nextSave();
      expect(bodyOf(fixed)).toEqual({
        baseRevision: 4,
        seoDescription: 'Кратко.',
      });
      fixed.flush({ ...DRAFT, draftRevision: 5 });
      await ui.settle();
      expect(status()).toBe(t.editor.save.saved);
    });

    it('refuses a slug the API would refuse, and sends an emptied one as null', async () => {
      await openEditor();

      await ui.type('#article-slug', 'Как-Да');
      await sleep(40);
      expect(drafts()).toHaveLength(0);
      expect(ui.text()).toContain(t.fields.slugError);

      await ui.type('#article-slug', '');
      const req = await nextSave();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, slug: null });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
    });

    it('drops a waiting slug once a save shows the article was published meanwhile', async () => {
      await openEditor();

      await ui.type('#article-slug', 'Лош адрес');
      await ui.type('#article-title', 'Ново');
      const req = await nextSave();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, title: 'Ново' });
      // Published in another tab: the slug is fixed now, and the API refuses one.
      req.flush({ ...PUBLISHED, draftRevision: 4 });
      await ui.settle();
      expect(ui.query('#article-slug')).toBeNull();

      await ui.type('#article-excerpt', 'Кратко.');
      const next = await nextSave();
      expect(bodyOf(next)).toEqual({ baseRevision: 4, excerpt: 'Кратко.' });
      next.flush({ ...PUBLISHED, draftRevision: 5 });
      await ui.settle();
      expect(status()).toBe(t.editor.save.saved);
    });

    it('saves the whole list of categories when one is ticked', async () => {
      await openEditor();

      checkbox('Хранене').click();
      await ui.settle();
      const req = await nextSave();
      expect(bodyOf(req)).toEqual({
        baseRevision: 3,
        categoryIds: ['c2', 'c1'],
      });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
    });

    it('chooses a featured image from the library, and removes it', async () => {
      await openEditor();

      await clickButton(t.settings.changeImage);
      http
        .expectOne('/api/media?page=1')
        .flush(page([image('m2', 'Въже'), image('m3', 'Гири')], 2));
      await ui.settle();
      const tiles = ui.queryAll<HTMLButtonElement>('.media-grid__item');
      expect(tiles.map((tile) => tile.querySelector('img')!.alt)).toEqual([
        'Въже',
        'Гири',
      ]);
      expect(button(en.content.media.picker.use)?.disabled).toBe(true);
      tiles[1].click();
      await ui.settle();
      await clickButton(en.content.media.picker.use);

      const req = await nextSave();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, featuredMediaId: 'm3' });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
      expect(
        ui.query<HTMLImageElement>('[data-testid="article-featured-image"]')!
          .alt,
      ).toBe('Гири');

      await clickButton(t.settings.removeImage);
      const removed = await nextSave();
      expect(bodyOf(removed)).toEqual({
        baseRevision: 4,
        featuredMediaId: null,
      });
      removed.flush({ ...DRAFT, draftRevision: 5 });
      await ui.settle();
      expect(ui.text()).toContain(t.settings.noFeaturedImage);
    });

    it('uploads a new image with its alt text and uses it', async () => {
      await openEditor();
      const picker = en.content.media.picker;

      await clickButton(t.settings.changeImage);
      http.expectOne('/api/media?page=1').flush(page([]));
      await ui.settle();
      await clickButton(picker.uploadAction);

      await clickButton(picker.uploadSubmit);
      expect(http.match('/api/media')).toHaveLength(0);
      expect(ui.text()).toContain(picker.fileError);
      expect(ui.text()).toContain(picker.altTextError);

      const file = new File(['jpg'], 'bar.jpg', { type: 'image/jpeg' });
      const input = ui.query<HTMLInputElement>('#media-file')!;
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
      await ui.type('#media-alt', '  Атлет вдига щанга  ');
      await clickButton(picker.uploadSubmit);

      const upload = http.expectOne('/api/media');
      const body = upload.request.body as FormData;
      expect((body.get('file') as File).name).toBe('bar.jpg');
      expect(body.get('altText')).toBe('Атлет вдига щанга');
      upload.flush(image('m9', 'Атлет вдига щанга'));
      await ui.settle();

      const req = await nextSave();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, featuredMediaId: 'm9' });
      req.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
    });

    it('drops an upload the admin cancelled, so it never reaches the next picker', async () => {
      await openEditor();
      const picker = en.content.media.picker;
      await clickButton(t.settings.changeImage);
      http.expectOne('/api/media?page=1').flush(page([]));
      await ui.settle();
      await clickButton(picker.uploadAction);
      const input = ui.query<HTMLInputElement>('#media-file')!;
      Object.defineProperty(input, 'files', {
        value: [new File(['jpg'], 'bar.jpg', { type: 'image/jpeg' })],
      });
      input.dispatchEvent(new Event('change'));
      await ui.type('#media-alt', 'Атлет');
      await clickButton(picker.uploadSubmit);
      const upload = http.expectOne('/api/media');

      await clickButton(picker.cancel);
      expect(upload.cancelled).toBe(true);

      // The next session starts on the library and waits for a choice.
      await clickButton(t.settings.changeImage);
      http.expectOne('/api/media?page=1').flush(page([image('m2', 'Въже')]));
      await ui.settle();
      expect(ui.query('dialog')!.hasAttribute('open')).toBe(true);
      expect(button(picker.use)?.disabled).toBe(true);
      await sleep(40);
      expect(drafts()).toHaveLength(0);
      expect(
        ui.query<HTMLImageElement>('[data-testid="article-featured-image"]')!
          .alt,
      ).toBe('Щанга на земята');
    });

    it('shows the API message when an upload is refused, and stays open', async () => {
      await openEditor();
      const picker = en.content.media.picker;
      await clickButton(t.settings.changeImage);
      http.expectOne('/api/media?page=1').flush(page([]));
      await ui.settle();
      await clickButton(picker.uploadAction);

      const input = ui.query<HTMLInputElement>('#media-file')!;
      Object.defineProperty(input, 'files', {
        value: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })],
      });
      input.dispatchEvent(new Event('change'));
      await ui.type('#media-alt', 'Документ');
      await clickButton(picker.uploadSubmit);
      const failure = apiError('Unsupported image: use JPEG, PNG or WebP');
      http.expectOne('/api/media').flush(failure.body, failure.options);
      await ui.settle();

      expect(ui.alert()).toBe('Unsupported image: use JPEG, PNG or WebP');
      expect(button(picker.uploadSubmit)?.disabled).toBe(false);
      expect(drafts()).toHaveLength(0);
    });

    it('hides the slug of a published article and shows its address and changes', async () => {
      await openEditor(PUBLISHED);

      expect(ui.query('#article-slug')).toBeNull();
      expect(ui.text()).toContain('/articles/kak-da-zapochnem');
      expect(
        ui
          .query('[data-testid="article-status"]')!
          .textContent?.replace(/\s+/g, ' ')
          .trim(),
      ).toBe(`Published · ${t.unpublishedChanges}`);
    });

    it('stops saving on a 409 and reloads the article on request', async () => {
      await openEditor();
      await ui.type('#article-title', 'Ново');
      const req = await nextSave();
      req.flush(
        {
          statusCode: 409,
          message: 'The article was changed in another tab.',
          currentRevision: 7,
        },
        { status: 409, statusText: 'Conflict' },
      );
      await ui.settle();

      expect(status()).toBe(t.editor.save.notSaved);
      expect(ui.alert()).toContain('The article was changed in another tab.');
      await ui.type('#article-title', 'Още по-ново');
      await sleep(40);
      expect(drafts()).toHaveLength(0);

      await clickButton(t.editor.reload);
      http.expectOne('/api/articles/a1').flush({
        ...DRAFT,
        draftRevision: 7,
        draft: { ...DRAFT.draft, title: 'От другия раздел' },
      });
      await ui.settle();
      // The featured image is known already, so it isn't fetched again.
      await sleep(50);
      await ui.settle();
      expect(value('#article-title')).toBe('От другия раздел');
      expect(status()).toBe(t.editor.save.saved);
    });

    it('keeps the changes after a failed save and sends them again on "Try again"', async () => {
      await openEditor();
      await ui.type('#article-title', 'Ново');
      const failure = apiError(undefined, 500);
      (await nextSave()).flush(failure.body, failure.options);
      await ui.settle();

      expect(status()).toBe(t.editor.save.failed);
      expect(ui.alert()).toBe(t.editor.save.error);
      await clickButton(en.common.tryAgain);
      const [retry] = drafts();
      expect(bodyOf(retry)).toEqual({ baseRevision: 3, title: 'Ново' });
      retry.flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
      expect(status()).toBe(t.editor.save.saved);
    });

    it('saves at once when leaving, then leaves', async () => {
      await openEditor();
      await ui.type('#article-title', 'Ново');

      const leaving = router.navigateByUrl('/content/articles');
      await sleep(0);
      const [req] = drafts();
      expect(bodyOf(req)).toEqual({ baseRevision: 3, title: 'Ново' });
      req.flush({ ...DRAFT, draftRevision: 4 });
      expect(await leaving).toBe(true);
      await ui.settle();
      expect(router.url).toBe('/content/articles');
      http.match(() => true);
    });

    it('asks before leaving when the last save fails, and stays when told to', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      await openEditor();
      await ui.type('#article-title', 'Ново');

      const leaving = router.navigateByUrl('/content/articles');
      await sleep(0);
      const failure = apiError(undefined, 500);
      drafts()[0].flush(failure.body, failure.options);

      expect(await leaving).toBe(false);
      expect(confirm).toHaveBeenCalledWith(t.editor.leaveUnsaved);
      expect(router.url).toBe('/content/articles/a1');
    });

    it('shows the API message when the article cannot be loaded', async () => {
      await open('/content/articles/a404');
      const failure = apiError('Article not found', 404);
      http.expectOne('/api/articles/a404').flush(failure.body, failure.options);
      http.expectOne('/api/article-categories').flush(CATEGORIES);
      await ui.settle();

      expect(ui.alert()).toBe('Article not found');
      expect(ui.query('#article-title')).toBeNull();
    });

    it('sends nothing without an id', async () => {
      await open('/missing-id');

      expect(ui.alert()).toBe(t.errors.missingId);
      expect(http.match(() => true)).toHaveLength(0);
    });
  });
});
