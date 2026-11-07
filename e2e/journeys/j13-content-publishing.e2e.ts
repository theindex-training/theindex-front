import { Page } from '@playwright/test';
import { articleApi } from '../support/article-api';
import { article, pageOf } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** Where the dev build (`ng serve`) sends previews and "View on site" links. */
const SITE = 'http://localhost:4321';

/**
 * TEST_PLAN.md J13: an admin publishes, updates, previews, unpublishes and deletes an article
 * (decision record item 11), with the confirmations for the dangerous steps.
 */
test.describe('J13 content publishing', () => {
  const publishButton = (page: Page) => page.getByTestId('article-publish');
  const settings = (page: Page) =>
    page.getByRole('complementary', {
      name: t('content.articles.settings.title'),
    });
  const confirmDialog = (page: Page, key: string) =>
    page.getByRole('dialog', {
      name: t(`content.articles.confirm.${key}.title`),
    });
  const status = (page: Page) => page.getByTestId('article-status');
  const titleField = (page: Page) =>
    page.getByRole('textbox', {
      name: t('content.articles.fields.title'),
      exact: true,
    });

  const withBody = (title: string) =>
    article('a-1', title, {
      draft: {
        ...article('a-1', title).draft,
        content: {
          blocks: [
            { type: 'paragraph', data: { text: 'Първата тренировка.' } },
          ],
        },
      },
    });

  test(
    'publishes after fixing the problems, previews, updates, unpublishes and deletes',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      // Autosave waits about 2 seconds after each change, more than once here.
      test.slow();
      await signInAs('ADMIN');
      api.on('GET', '/api/article-categories', { body: [] });
      api.on('GET', '/api/articles', { body: pageOf([]) });
      const current = articleApi(api, withBody(''));
      await page.context().route(`${SITE}/**`, (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<title>Preview</title>',
        }),
      );

      await page.goto('/content/articles/a-1');
      await expect(publishButton(page)).toHaveText(
        t('content.articles.actions.publish'),
      );

      // The API lists what stops it from going live.
      await publishButton(page).click();
      await expect(page.getByRole('alert')).toContainText(
        t('content.articles.actions.problemsTitle'),
      );
      await expect(page.getByRole('alert').getByRole('listitem')).toHaveText([
        'The article needs a title',
      ]);

      // With a title it goes live; the change is saved first, then that revision is published.
      await titleField(page).fill('Как да започнем');
      await publishButton(page).click();
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: t('content.articles.actions.published') }),
      ).toBeVisible();
      expect(api.last('POST', '/api/articles/a-1/publish')?.body).toEqual({
        baseRevision: 1,
      });
      await expect(status(page)).toHaveText(t('enums.articleStatus.PUBLISHED'));
      await expect(
        page.getByRole('link', {
          name: t('content.articles.actions.viewOnSite'),
        }),
      ).toHaveAttribute('href', `${SITE}/articles/kak-da-zapochnem`);
      await expect(publishButton(page)).toHaveText(
        t('content.articles.actions.update'),
      );
      await expect(publishButton(page)).toBeDisabled();

      // Preview opens the site's preview of the draft in a new tab.
      const popup = page.waitForEvent('popup');
      await page
        .getByRole('button', { name: t('content.articles.actions.preview') })
        .click();
      const tab = await popup;
      await tab.waitForURL(`${SITE}/preview?token=tok-1`);
      await tab.close();

      // A change makes "Update" available; it publishes the new revision.
      await settings(page)
        .getByRole('textbox', { name: t('content.articles.fields.excerpt') })
        .fill('Първи стъпки.');
      await expect(publishButton(page)).toBeEnabled();
      await expect(status(page)).toContainText(
        t('content.articles.unpublishedChanges'),
      );
      await publishButton(page).click();
      await expect(
        page.getByText(t('content.articles.actions.updated')),
      ).toBeVisible();
      expect(current().published).toMatchObject({ excerpt: 'Първи стъпки.' });
      await expect(publishButton(page)).toBeDisabled();

      // Unpublish asks first; Cancel changes nothing.
      const unpublish = settings(page).getByRole('button', {
        name: t('content.articles.actions.unpublish'),
      });
      await unpublish.click();
      const askUnpublish = confirmDialog(page, 'unpublish');
      await expect(askUnpublish).toContainText(
        t('content.articles.confirm.unpublish.message'),
      );
      await askUnpublish
        .getByRole('button', { name: t('common.cancel') })
        .click();
      await expect(askUnpublish).toBeHidden();
      expect(api.calls('POST', '/api/articles/a-1/unpublish')).toHaveLength(0);

      await unpublish.click();
      await askUnpublish
        .getByRole('button', {
          name: t('content.articles.confirm.unpublish.confirm'),
        })
        .click();
      await expect(status(page)).toHaveText(
        t('enums.articleStatus.UNPUBLISHED'),
      );
      await expect(publishButton(page)).toHaveText(
        t('content.articles.actions.republish'),
      );

      // Delete permanently, after its own confirmation, and back to the list.
      await settings(page)
        .getByRole('button', { name: t('content.articles.actions.delete') })
        .click();
      const askDelete = confirmDialog(page, 'delete');
      await expect(askDelete).toContainText(
        t('content.articles.confirm.delete.message'),
      );
      // The safe answer has the focus.
      await expect(
        askDelete.getByRole('button', { name: t('common.cancel') }),
      ).toBeFocused();
      await askDelete
        .getByRole('button', {
          name: t('content.articles.confirm.delete.confirm'),
        })
        .click();
      await expect(page).toHaveURL(/\/content\/articles$/);
      expect(api.calls('DELETE', '/api/articles/a-1')).toHaveLength(1);
    },
  );

  test(
    'on a phone, discards the unpublished changes after the confirmation',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      api.on('GET', '/api/article-categories', { body: [] });
      const live = withBody('Как да започнем');
      const changed = {
        ...live,
        status: 'PUBLISHED',
        slug: 'kak-da-zapochnem',
        firstPublishedAt: '2026-11-01T10:00:00.000Z',
        lastPublishedAt: '2026-11-01T10:00:00.000Z',
        published: {
          ...live.draft,
          categoryIds: [],
        } as never,
        draft: { ...live.draft, title: 'Как да започнем с КросФит' },
        hasUnpublishedChanges: true,
      };
      articleApi(api, changed);

      await page.goto('/content/articles/a-1');
      await expect(titleField(page)).toHaveValue('Как да започнем с КросФит');

      await settings(page)
        .getByRole('button', { name: t('content.articles.actions.discard') })
        .click();
      await confirmDialog(page, 'discard')
        .getByRole('button', {
          name: t('content.articles.confirm.discard.confirm'),
        })
        .click();

      await expect(titleField(page)).toHaveValue('Как да започнем');
      expect(api.last('POST', '/api/articles/a-1/discard-draft')?.body).toEqual(
        { baseRevision: 0 },
      );
      await expect(status(page)).toHaveText(t('enums.articleStatus.PUBLISHED'));
      await expect(publishButton(page)).toBeDisabled();
    },
  );
});
