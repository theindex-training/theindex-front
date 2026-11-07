import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '@environments/environment';
import en from '../../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../../testing/dom';
import { signInAs } from '../../../../testing/jwt';
import { Article } from '../../../services/articles.service';
import {
  AUTOSAVE_DELAY,
  ArticleEditorComponent,
} from './article-editor.component';
import { leaveEditorGuard } from './leave-editor.guard';

/**
 * The editor's lifecycle actions (decision record item 11): Publish / Publish again / Update,
 * Preview, Unpublish, Discard changes and Delete permanently, with their confirmations.
 */

const t = en.content.articles;
const actions = t.actions;
const confirm = t.confirm;

const DRAFT: Article = {
  id: 'a1',
  language: 'bg',
  status: 'DRAFT',
  slug: null,
  published: null,
  draft: {
    title: 'Как да започнем',
    excerpt: null,
    content: {
      blocks: [{ id: 'p1', type: 'paragraph', data: { text: 'Текст.' } }],
    },
    featuredMediaId: null,
    categoryIds: [],
    seoTitle: null,
    seoDescription: null,
    slug: null,
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

/** What the API answers a publish of DRAFT: live, and the site shows the draft. */
const LIVE: Article = {
  ...DRAFT,
  status: 'PUBLISHED',
  slug: 'kak-da-zapochnem',
  hasUnpublishedChanges: false,
  firstPublishedAt: '2026-11-07T10:00:00Z',
  lastPublishedAt: '2026-11-07T10:00:00Z',
  published: {
    title: 'Как да започнем',
    excerpt: null,
    content: DRAFT.draft.content,
    featuredMediaId: null,
    seoTitle: null,
    seoDescription: null,
    categoryIds: [],
  },
};

/** Live, with a draft that has moved on since. */
const CHANGED: Article = {
  ...LIVE,
  hasUnpublishedChanges: true,
  draft: { ...LIVE.draft, title: 'Как да започнем с КросФит' },
};

const OFFLINE: Article = {
  ...LIVE,
  status: 'UNPUBLISHED',
  unpublishedAt: '2026-11-07T11:00:00Z',
};

describe('article lifecycle in the editor', () => {
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
          {
            path: 'content/articles/:id',
            component: ArticleEditorComponent,
            canDeactivate: [leaveEditorGuard],
          },
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

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function openEditor(article: Article = DRAFT) {
    await harness.navigateByUrl(`/content/articles/${article.id}`);
    ui = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await ui.settle();
    http.expectOne(`/api/articles/${article.id}`).flush(article);
    http.expectOne('/api/article-categories').flush([]);
    await ui.settle();
    await sleep(50);
    await ui.settle();
  }

  const buttons = (label: string) =>
    ui
      .queryAll<HTMLButtonElement>('button')
      .filter((b) => b.textContent?.trim() === label);
  const button = (label: string) => buttons(label)[0];
  const click = async (target: HTMLElement | undefined) => {
    if (!target) throw new Error('No such button');
    target.click();
    await ui.settle();
  };
  const publishButton = () =>
    ui.query<HTMLButtonElement>('[data-testid="article-publish"]')!;
  const dialog = () =>
    ui.query<HTMLDialogElement>('app-confirm-dialog dialog')!;
  const dialogButton = (label: string) =>
    Array.from(dialog().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    );
  const statusText = () =>
    ui
      .query('[data-testid="article-status"]')!
      .textContent?.replace(/\s+/g, ' ')
      .trim();
  const post = (path: string) =>
    http.expectOne({ method: 'POST', url: `/api/articles/a1/${path}` });
  const bodyOf = (req: TestRequest) =>
    JSON.parse(req.request.serializeBody() as string) as unknown;
  const drafts = () =>
    http.match({ method: 'PATCH', url: '/api/articles/a1/draft' });

  describe('publish and update', () => {
    it('publishes a draft at the revision it has, and shows where it is live', async () => {
      await openEditor();
      expect(publishButton().textContent?.trim()).toBe(actions.publish);

      await click(publishButton());
      const req = post('publish');
      expect(bodyOf(req)).toEqual({ baseRevision: 3 });
      expect(publishButton().textContent?.trim()).toBe(actions.publishing);
      expect(publishButton().disabled).toBe(true);
      req.flush(LIVE);
      await ui.settle();

      expect(
        ui.query('[role="status"].notice--success')!.textContent,
      ).toContain(actions.published);
      const links = ui
        .queryAll<HTMLAnchorElement>('a[target="_blank"]')
        .map((a) => a.getAttribute('href'));
      expect(links).toContain(
        `${environment.publicSiteUrl}/articles/kak-da-zapochnem`,
      );
      expect(statusText()).toBe('Published');
      expect(ui.query('#article-slug')).toBeNull();
      // Nothing to update until the draft changes again.
      expect(publishButton().textContent?.trim()).toBe(actions.update);
      expect(publishButton().disabled).toBe(true);
      expect(button(actions.unpublish)).toBeDefined();
      expect(button(actions.delete)).toBeUndefined();
      expect(ui.text()).toContain(actions.deleteHint);
    });

    it('saves a change waiting for autosave first, then publishes that revision', async () => {
      await openEditor();
      await ui.type('#article-title', 'Ново заглавие');

      await click(publishButton());
      await sleep(0);
      const [save] = drafts();
      expect(bodyOf(save)).toEqual({ baseRevision: 3, title: 'Ново заглавие' });
      save.flush({ ...DRAFT, draftRevision: 4 });
      await sleep(0);
      await ui.settle();

      const req = post('publish');
      expect(bodyOf(req)).toEqual({ baseRevision: 4 });
      req.flush({ ...LIVE, draftRevision: 4 });
      await ui.settle();
    });

    it('publishes nothing while a field has an error, and says why', async () => {
      await openEditor();
      await ui.type('#article-seo-description', 'а'.repeat(161));

      await click(publishButton());
      await sleep(40);
      await ui.settle();

      expect(http.match({ method: 'POST' })).toHaveLength(0);
      expect(ui.alert()).toBe(actions.saveFirst);
      expect(publishButton().disabled).toBe(false);
    });

    it('lists every problem the API finds, and gives the button back', async () => {
      await openEditor();
      await click(publishButton());
      const failure = apiError([
        'The article needs a title',
        'The featured image no longer exists',
      ]);
      post('publish').flush(failure.body, failure.options);
      await ui.settle();

      const alert = ui.query('[role="alert"]')!;
      expect(alert.querySelector('p')!.textContent?.trim()).toBe(
        actions.problemsTitle,
      );
      expect(
        Array.from(alert.querySelectorAll('li')).map((li) =>
          li.textContent?.trim(),
        ),
      ).toEqual([
        'The article needs a title',
        'The featured image no longer exists',
      ]);
      expect(statusText()).toBe('Draft');
      expect(publishButton().disabled).toBe(false);

      await click(
        ui.query<HTMLButtonElement>(`[aria-label="${actions.dismiss}"]`)!,
      );
      expect(ui.query('[role="alert"]')).toBeNull();
    });

    it('shows the API message for a refused publish (409)', async () => {
      await openEditor();
      await click(publishButton());
      const failure = apiError(
        'The slug was just taken by another article; publish again to get a new one',
        409,
      );
      post('publish').flush(failure.body, failure.options);
      await ui.settle();

      expect(ui.alert()).toBe(
        'The slug was just taken by another article; publish again to get a new one',
      );
    });

    it('updates a published article whose draft has changed', async () => {
      await openEditor(CHANGED);
      expect(statusText()).toBe(`Published · ${t.unpublishedChanges}`);
      expect(publishButton().textContent?.trim()).toBe(actions.update);

      await click(publishButton());
      post('publish').flush({ ...CHANGED, hasUnpublishedChanges: false });
      await ui.settle();

      expect(ui.text()).toContain(actions.updated);
      expect(statusText()).toBe('Published');
      expect(publishButton().disabled).toBe(true);
    });

    it('keeps "Unpublished changes" when the draft was saved again while publishing', async () => {
      await openEditor();
      await click(publishButton());
      const req = post('publish');

      await ui.type('#article-title', 'Още по-ново');
      await sleep(40);
      await ui.settle();
      drafts()[0].flush({ ...DRAFT, draftRevision: 4 });
      await ui.settle();
      req.flush(LIVE);
      await ui.settle();

      expect(statusText()).toBe(`Published · ${t.unpublishedChanges}`);
      expect(publishButton().disabled).toBe(false);
    });

    it('calls the button "Publish again" for an unpublished article', async () => {
      await openEditor(OFFLINE);

      expect(publishButton().textContent?.trim()).toBe(actions.republish);
      expect(publishButton().disabled).toBe(false);
      expect(button(actions.delete)).toBeDefined();
      expect(button(actions.unpublish)).toBeUndefined();
    });
  });

  describe('preview', () => {
    function fakeTab() {
      return {
        opener: {} as unknown,
        location: { href: '' },
        close: vi.fn(),
      };
    }

    it('opens a tab in the click, then sends it to the site preview with a token', async () => {
      const tab = fakeTab();
      const open = vi
        .spyOn(window, 'open')
        .mockReturnValue(tab as unknown as Window);
      await openEditor();

      await click(button(actions.preview));
      expect(open).toHaveBeenCalledWith('', '_blank');
      expect(tab.opener).toBeNull();
      await sleep(0);
      post('preview-token').flush({
        token: 'abc.def',
        expiresAt: '2026-11-07T10:30:00Z',
      });
      await ui.settle();

      expect(tab.location.href).toBe(
        `${environment.publicSiteUrl}/preview?token=abc.def`,
      );
      expect(ui.query('[role="alert"]')).toBeNull();
    });

    it('closes the tab and says so when no token comes', async () => {
      const tab = fakeTab();
      vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
      await openEditor();

      await click(button(actions.preview));
      await sleep(0);
      const failure = apiError(undefined, 500);
      post('preview-token').flush(failure.body, failure.options);
      await ui.settle();

      expect(tab.close).toHaveBeenCalled();
      expect(ui.alert()).toBe(actions.previewError);
    });
  });

  describe('unpublish, discard and delete', () => {
    it('asks before unpublishing, and does nothing on Cancel', async () => {
      await openEditor(LIVE);

      await click(button(actions.unpublish));
      expect(dialog().hasAttribute('open')).toBe(true);
      expect(dialog().textContent).toContain(confirm.unpublish.title);
      expect(dialog().textContent).toContain(confirm.unpublish.message);
      await click(dialogButton(en.common.cancel));

      expect(dialog().hasAttribute('open')).toBe(false);
      expect(http.match({ method: 'POST' })).toHaveLength(0);
      expect(statusText()).toBe('Published');
    });

    it('unpublishes after the confirmation and offers to publish again or delete', async () => {
      await openEditor(LIVE);

      await click(button(actions.unpublish));
      await click(dialogButton(confirm.unpublish.confirm));
      const req = post('unpublish');
      expect(bodyOf(req)).toEqual({});
      req.flush(OFFLINE);
      await ui.settle();

      expect(ui.text()).toContain(actions.unpublished);
      expect(statusText()).toBe('Unpublished');
      expect(publishButton().textContent?.trim()).toBe(actions.republish);
      expect(button(actions.delete)).toBeDefined();
    });

    it('discards the changes after the confirmation and shows the live version', async () => {
      await openEditor(CHANGED);
      expect(ui.query<HTMLTextAreaElement>('#article-title')!.value).toBe(
        'Как да започнем с КросФит',
      );

      await click(button(actions.discard));
      expect(dialog().textContent).toContain(confirm.discard.message);
      await click(dialogButton(confirm.discard.confirm));
      await sleep(0);
      const req = post('discard-draft');
      expect(bodyOf(req)).toEqual({ baseRevision: 3 });
      req.flush({ ...LIVE, draftRevision: 4 });
      await ui.settle();
      await sleep(50);
      await ui.settle();

      expect(ui.query<HTMLTextAreaElement>('#article-title')!.value).toBe(
        'Как да започнем',
      );
      expect(ui.text()).toContain(actions.discarded);
      expect(
        ui
          .queryAll('aside button')
          .map((b) => b.textContent?.trim())
          .includes(actions.discard),
      ).toBe(false);

      // Autosave goes on from the restored revision.
      await ui.type('#article-title', 'Отново');
      await sleep(40);
      const [save] = drafts();
      expect(bodyOf(save)).toEqual({ baseRevision: 4, title: 'Отново' });
      save.flush({ ...CHANGED, draftRevision: 5 });
      await ui.settle();
    });

    it('deletes a draft after the confirmation and goes back to the list', async () => {
      await openEditor();

      await click(button(actions.delete));
      expect(dialog().textContent).toContain(confirm.delete.message);
      await click(dialogButton(confirm.delete.confirm));
      const req = http.expectOne({ method: 'DELETE', url: '/api/articles/a1' });
      req.flush({ deleted: true });
      await ui.settle();

      expect(router.url).toBe('/content/articles');
    });

    it('stays when the delete is refused, with the API message', async () => {
      await openEditor(OFFLINE);

      await click(button(actions.delete));
      await click(dialogButton(confirm.delete.confirm));
      const failure = apiError(
        'Unpublish the article before deleting it permanently',
        409,
      );
      http
        .expectOne({ method: 'DELETE', url: '/api/articles/a1' })
        .flush(failure.body, failure.options);
      await ui.settle();

      expect(ui.alert()).toBe(
        'Unpublish the article before deleting it permanently',
      );
      expect(router.url).toBe('/content/articles/a1');
      expect(button(actions.delete)?.disabled).toBe(false);
    });

    it('takes Escape or the backdrop as "no"', async () => {
      await openEditor();

      await click(button(actions.delete));
      // Escape and the backdrop close the dialog without an answer.
      dialog().close();
      await ui.settle();

      expect(http.match({ method: 'DELETE' })).toHaveLength(0);
      expect(router.url).toBe('/content/articles/a1');
    });
  });
});
