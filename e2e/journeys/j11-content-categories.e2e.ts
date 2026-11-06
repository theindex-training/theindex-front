import { Page } from '@playwright/test';
import { apiError } from '../support/api-mock';
import { articleCategory, mockStaffHome, pageOf } from '../support/data';
import { expect, test } from '../support/fixtures';
import { t } from '../support/i18n';

/** TEST_PLAN.md J11: an admin manages the article categories of the public site (/content). */
test.describe('J11 content categories', () => {
  const mainNav = (page: Page) =>
    page.getByRole('navigation', { name: t('nav.mainLabel') });
  const contentNav = (page: Page) =>
    page.getByRole('navigation', { name: t('content.nav.label') });
  const field = (page: Page, key: string) =>
    page.getByLabel(t(key), { exact: true });

  test(
    'opens Content from the sidebar, creates, edits and deletes a category',
    { tag: '@desktop' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);
      const nutrition = articleCategory('c-1', 'Хранене', 'hranene', {
        description: 'Какво да ядем.',
      });
      let created = articleCategory('c-new', 'Мобилност', 'mobilnost', {
        sortOrder: 1,
      });
      api.on('GET', '/api/article-categories', () => ({
        body: api.calls('POST', '/api/article-categories').length
          ? [nutrition, created]
          : [nutrition],
      }));
      api.on('POST', '/api/article-categories', { status: 201, body: created });
      api.on('GET', '/api/article-categories/c-new', () => ({ body: created }));
      api.on('PATCH', '/api/article-categories/c-new', (request) => {
        const changes = request.body as { slug?: string };
        if (changes.slug === 'hranene') {
          return apiError(409, 'The slug "hranene" is already in use');
        }
        created = { ...created, ...(request.body as object) };
        return { body: created };
      });
      api.on('DELETE', '/api/article-categories/c-new', {
        body: { deleted: true },
      });

      api.on('GET', '/api/articles', { body: pageOf([]) });

      // Content lives in the Manage group and opens on the articles; its tabs lead to categories.
      await page.goto('/home');
      await mainNav(page)
        .getByRole('link', { name: t('nav.content') })
        .click();
      await expect(page).toHaveURL(/\/content\/articles$/);
      await contentNav(page)
        .getByRole('link', { name: t('content.nav.categories') })
        .click();
      await expect(page).toHaveURL(/\/content\/categories$/);
      await expect(
        contentNav(page).getByRole('link', {
          name: t('content.nav.categories'),
        }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        mainNav(page).getByRole('link', { name: t('nav.content') }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(page.getByTestId('list-count')).toHaveText(
        t('content.categories.list.count', { count: 1 }),
      );

      // Create one with only a name: the API picks the slug and puts it last.
      await page
        .getByRole('link', { name: t('content.categories.list.new') })
        .first()
        .click();
      await field(page, 'content.categories.fields.name').fill('Мобилност');
      await page
        .getByRole('button', { name: t('content.categories.create.submit') })
        .click();
      await expect(page).toHaveURL(/\/content\/categories$/);
      expect(api.last('POST', '/api/article-categories')?.body).toEqual({
        name: 'Мобилност',
      });
      await expect(page.getByTestId('list-count')).toHaveText(
        t('content.categories.list.count', { count: 2 }),
      );

      // Edit it: a slug that is taken is refused by the API, and the message shows.
      await page.getByRole('link', { name: 'Мобилност', exact: true }).click();
      await expect(page).toHaveURL(/\/content\/categories\/c-new\/edit$/);
      const slug = page.getByRole('textbox', {
        name: t('content.categories.fields.slug'),
      });
      await expect(slug).toHaveValue('mobilnost');
      await slug.fill('hranene');
      await page.getByRole('button', { name: t('common.saveChanges') }).click();
      await expect(page.getByRole('alert')).toHaveText(
        'The slug "hranene" is already in use',
      );

      await slug.fill('mobilnost-i-gavkavost');
      // Optional fields carry "(optional)" in their label, so match by role and name.
      await page
        .getByRole('textbox', {
          name: t('content.categories.fields.description'),
        })
        .fill('Обхват на движение.');
      await page.getByRole('button', { name: t('common.saveChanges') }).click();
      await expect(page).toHaveURL(/\/content\/categories$/);
      expect(api.last('PATCH', '/api/article-categories/c-new')?.body).toEqual({
        name: 'Мобилност',
        slug: 'mobilnost-i-gavkavost',
        description: 'Обхват на движение.',
        sortOrder: 1,
      });

      // Delete it from its edit page, after the warning.
      await page.getByRole('link', { name: 'Мобилност', exact: true }).click();
      await page
        .getByRole('link', { name: t('content.categories.edit.delete') })
        .click();
      await expect(page).toHaveURL(/\/content\/categories\/c-new\/delete$/);
      await expect(
        page.getByText(t('content.categories.delete.warning')),
      ).toBeVisible();
      await page
        .getByRole('button', { name: t('content.categories.delete.submit') })
        .click();
      await expect(page).toHaveURL(/\/content\/categories$/);
      expect(api.calls('DELETE', '/api/article-categories/c-new')).toHaveLength(
        1,
      );
    },
  );

  test(
    'on a phone, Content is in the More sheet and lists categories as rows',
    { tag: '@mobile' },
    async ({ page, api, signInAs }) => {
      await signInAs('ADMIN');
      mockStaffHome(api);
      api.on('GET', '/api/article-categories', {
        body: [articleCategory('c-1', 'Хранене', 'hranene')],
      });
      api.on('GET', '/api/article-categories/c-1', {
        body: articleCategory('c-1', 'Хранене', 'hranene'),
      });
      api.on('GET', '/api/articles', { body: pageOf([]) });

      await page.goto('/home');
      await mainNav(page)
        .getByRole('button', { name: t('nav.more') })
        .click();
      await page
        .getByRole('dialog', { name: t('nav.more') })
        .getByRole('navigation', { name: t('nav.morePages') })
        .getByRole('link', { name: t('nav.content') })
        .click();
      await expect(page).toHaveURL(/\/content\/articles$/);
      await contentNav(page)
        .getByRole('link', { name: t('content.nav.categories') })
        .click();
      await expect(page).toHaveURL(/\/content\/categories$/);

      // The phone list shows the slug under the name; the row opens the edit page.
      await page
        .getByRole('list', { name: t('content.categories.list.title') })
        .getByRole('link')
        .click();
      await expect(page).toHaveURL(/\/content\/categories\/c-1\/edit$/);
      await expect(field(page, 'content.categories.fields.name')).toHaveValue(
        'Хранене',
      );
    },
  );
});
