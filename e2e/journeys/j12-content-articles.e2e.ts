import { Page } from '@playwright/test';
import { RecordedRequest } from '../support/api-mock';
import {
  article,
  articleCategory,
  articleSummary,
  mediaItem,
  mockStaffHome,
  pageOf,
} from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

type DraftBody = Record<string, unknown> & {
  baseRevision: number;
  content?: { blocks: { type: string; data: Record<string, unknown> }[] };
};

/**
 * TEST_PLAN.md J12: an admin writes an article in the back office (decision record item 10): the
 * list, "New article", Editor.js with autosave, the settings panel and the media picker.
 */
test.describe('J12 content articles', () => {
  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });
  const saveStatus = (page: Page) => page.getByTestId('article-save-status');
  const settings = (page: Page) =>
    page.getByRole('complementary', {
      name: t('content.articles.settings.title'),
    });
  const picker = (page: Page) =>
    page.getByRole('dialog', { name: t('content.media.picker.title') });

  /** Answers autosaves like the API: merges the changes and counts the revision up. */
  function draftApi(
    api: import('../support/api-mock').ApiMock,
    start: ReturnType<typeof article>,
  ) {
    let current = start;
    api.on('GET', `/api/articles/${start.id}`, () => ({ body: current }));
    api.on('PATCH', `/api/articles/${start.id}/draft`, (request) => {
      const { baseRevision, ...changes } = request.body as DraftBody;
      if (baseRevision !== current.draftRevision) {
        return {
          status: 409,
          body: { statusCode: 409, message: 'Stale', currentRevision: 0 },
        };
      }
      current = {
        ...current,
        draft: { ...current.draft, ...changes },
        draftRevision: current.draftRevision + 1,
      };
      return { body: current };
    });
    return () => current;
  }

  const saves = (
    api: import('../support/api-mock').ApiMock,
    id: string,
  ): DraftBody[] =>
    api
      .calls('PATCH', `/api/articles/${id}/draft`)
      .map((call: RecordedRequest) => call.body as DraftBody);

  test(
    'lists articles, creates one and writes it with autosave, settings and images',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      // Autosave waits about 2 seconds after each change, several times over.
      test.slow();
      await signInAs('ADMIN');
      mockStaffHome(api);
      api.on('GET', '/api/article-categories', {
        body: [
          articleCategory('c-1', 'Хранене', 'hranene'),
          articleCategory('c-2', 'Техника', 'tehnika', { sortOrder: 1 }),
        ],
      });
      api.on('GET', '/api/articles', (request) => ({
        body: pageOf(
          request.query['status'] === 'PUBLISHED'
            ? [
                articleSummary('a-pub', 'Защо клековете са важни', {
                  status: 'PUBLISHED',
                  slug: 'zashto-klekovete-sa-vazhni',
                  hasUnpublishedChanges: false,
                  categoryIds: ['c-2'],
                }),
              ]
            : [
                articleSummary('a-pub', 'Защо клековете са важни', {
                  status: 'PUBLISHED',
                  hasUnpublishedChanges: false,
                  categoryIds: ['c-2'],
                }),
                articleSummary('a-old', 'Чернова за хранене'),
              ],
        ),
      }));
      api.on('POST', '/api/articles', {
        status: 201,
        body: article('a-new', 'Как да започнем'),
      });
      const current = draftApi(api, article('a-new', 'Как да започнем'));
      api.on('GET', '/api/media', {
        body: pageOf([mediaItem('m-1', 'Щанга на земята')]),
      });
      api.on('POST', '/api/media', {
        status: 201,
        body: mediaItem('m-2', 'Атлет вдига щанга'),
      });

      // Content opens on the articles; the status filter asks the API.
      await page.goto('/home');
      await mainNav(page)
        .getByRole('link', { name: t('nav.content') })
        .click();
      await expect(page).toHaveURL(/\/content\/articles$/);
      const table = page.getByRole('region', {
        name: t('content.articles.list.tableLabel'),
      });
      await expect(table.getByRole('row')).toHaveCount(3);
      await expect(
        table.getByRole('row', { name: /Защо клековете са важни/ }),
      ).toContainText('Техника');
      await page
        .getByRole('group', { name: t('common.status') })
        .getByText(t('content.articles.list.filter.PUBLISHED'))
        .click();
      await expect
        .poll(() => api.last('GET', '/api/articles')?.query)
        .toEqual({
          status: 'PUBLISHED',
          page: '1',
          pageSize: '20',
        });
      await expect(table.getByRole('row')).toHaveCount(2);

      // New article: a title first, then the editor opens on the draft.
      await page
        .getByRole('link', { name: t('content.articles.list.new') })
        .first()
        .click();
      await page
        .getByLabel(t('content.articles.fields.title'), { exact: true })
        .fill('Как да започнем');
      await page
        .getByRole('button', { name: t('content.articles.create.submit') })
        .click();
      await expect(page).toHaveURL(/\/content\/articles\/a-new$/);
      expect(api.last('POST', '/api/articles')?.body).toEqual({
        title: 'Как да започнем',
      });

      // The editor is full screen: no app navigation, its own Back link.
      await expect(mainNav(page)).toHaveCount(0);
      await expect(
        page.getByRole('textbox', {
          name: t('content.articles.fields.title'),
          exact: true,
        }),
      ).toHaveValue('Как да започнем');
      await expect(saveStatus(page)).toHaveText(
        t('content.articles.editor.save.saved'),
      );

      // Typing in the body autosaves the blocks, once, after a pause.
      await page.getByTestId('article-body').click();
      await page.keyboard.type('Първата тренировка е най-трудна.');
      await expect(saveStatus(page)).toHaveText(
        t('content.articles.editor.save.saved'),
      );
      await expect
        .poll(() => current().draft.content.blocks)
        .toEqual([
          expect.objectContaining({
            type: 'paragraph',
            data: { text: 'Първата тренировка е най-трудна.' },
          }),
        ]);
      expect(saves(api, 'a-new')[0]).toEqual({
        baseRevision: 0,
        content: expect.objectContaining({ blocks: expect.any(Array) }),
      });

      // A YouTube video from the toolbox: "/" in a new, empty block opens it, and typing filters
      // it. Editor.js wires a new block up when the browser is idle, so wait for that first.
      await page.keyboard.press('Enter');
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => requestIdleCallback(() => resolve())),
      );
      await page.keyboard.type('/');
      const filter = page.getByRole('textbox', {
        name: t('content.articles.blocks.filter'),
      });
      await expect(filter).toBeFocused();
      await page.keyboard.type('YouTube');
      await expect(filter).toHaveValue('YouTube');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      const link = page.getByLabel(t('content.articles.blocks.videoLink'));
      await link.fill('https://youtu.be/dQw4w9WgXcQ');
      await link.press('Enter');
      await expect(
        page.getByRole('link', {
          name: t('content.articles.blocks.videoOpen'),
        }),
      ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await expect
        .poll(() => current().draft.content.blocks.map((b) => b.type))
        .toEqual(['paragraph', 'embed']);
      expect(current().draft.content.blocks[1]).toMatchObject({
        data: { service: 'youtube', videoId: 'dQw4w9WgXcQ' },
      });

      // The settings panel: excerpt and a category, saved as changed fields only.
      await settings(page)
        .getByRole('textbox', { name: t('content.articles.fields.excerpt') })
        .fill('Първи стъпки в залата.');
      await settings(page).getByLabel('Техника').check();
      await expect
        .poll(() => current().draft)
        .toMatchObject({
          excerpt: 'Първи стъпки в залата.',
          categoryIds: ['c-2'],
        });
      for (const body of saves(api, 'a-new').slice(-1)) {
        expect(Object.keys(body).sort()).toEqual(
          ['baseRevision', 'categoryIds', 'excerpt'].sort(),
        );
      }

      // Featured image from the library.
      await settings(page)
        .getByRole('button', {
          name: t('content.articles.settings.chooseImage'),
        })
        .click();
      await picker(page)
        .getByRole('button', { name: 'Щанга на земята' })
        .click();
      await picker(page)
        .getByRole('button', { name: t('content.media.picker.use') })
        .click();
      await expect(picker(page)).toBeHidden();
      await expect(
        settings(page).getByRole('img', { name: 'Щанга на земята' }),
      ).toBeVisible();
      await expect.poll(() => current().draft.featuredMediaId).toBe('m-1');

      // Or a new upload: the alt text is required.
      await settings(page)
        .getByRole('button', {
          name: t('content.articles.settings.changeImage'),
        })
        .click();
      await picker(page)
        .getByRole('group', { name: t('content.media.picker.modeLabel') })
        .getByText(t('content.media.picker.upload'))
        .click();
      await picker(page)
        .getByLabel(t('content.media.picker.file'))
        .setInputFiles({
          name: 'bar.png',
          mimeType: 'image/png',
          buffer: Buffer.from('not really a png'),
        });
      await picker(page)
        .getByRole('button', { name: t('content.media.picker.uploadSubmit') })
        .click();
      await expect(
        picker(page).getByText(t('content.media.picker.altTextError')),
      ).toBeVisible();
      expect(api.calls('POST', '/api/media')).toHaveLength(0);
      await picker(page)
        .getByLabel(t('content.media.picker.altText'))
        .fill('Атлет вдига щанга');
      await picker(page)
        .getByRole('button', { name: t('content.media.picker.uploadSubmit') })
        .click();
      await expect(picker(page)).toBeHidden();
      const upload = String(api.last('POST', '/api/media')?.body);
      expect(upload).toContain('name="altText"');
      expect(upload).toContain('Атлет вдига щанга');
      expect(upload).toContain('filename="bar.png"');
      await expect.poll(() => current().draft.featuredMediaId).toBe('m-2');

      // Leaving saves what is left first, then the list opens.
      await page
        .getByRole('textbox', {
          name: t('content.articles.fields.title'),
          exact: true,
        })
        .fill('Как да започнем с КросФит');
      await page
        .getByRole('link', { name: t('content.articles.editor.back') })
        .click();
      await expect(page).toHaveURL(/\/content\/articles$/);
      expect(current().draft.title).toBe('Как да започнем с КросФит');
    },
  );

  test(
    'on a phone, rows open the editor, and the settings follow the text',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      api.on('GET', '/api/article-categories', { body: [] });
      api.on('GET', '/api/articles', {
        body: pageOf([articleSummary('a-1', 'Чернова за хранене')]),
      });
      const current = draftApi(
        api,
        article('a-1', 'Чернова за хранене', {
          draft: {
            ...article('a-1', '').draft,
            title: 'Чернова за хранене',
            content: {
              blocks: [
                { id: 'p1', type: 'paragraph', data: { text: 'Протеин.' } },
              ],
            },
          },
        }),
      );

      await page.goto('/content/articles');
      await page
        .getByRole('list', { name: t('content.articles.list.title') })
        .getByRole('link', { name: /Чернова за хранене/ })
        .click();
      await expect(page).toHaveURL(/\/content\/articles\/a-1$/);
      await expect(page.getByTestId('article-body')).toContainText('Протеин.');

      await settings(page)
        .getByRole('textbox', { name: t('content.articles.fields.seoTitle') })
        .fill('Хранене за начинаещи');
      await expect
        .poll(() => current().draft.seoTitle)
        .toBe('Хранене за начинаещи');
      await expect(saveStatus(page)).toHaveText(
        t('content.articles.editor.save.saved'),
      );
      expect(saves(api, 'a-1')).toEqual([
        { baseRevision: 0, seoTitle: 'Хранене за начинаещи' },
      ]);
    },
  );
});
