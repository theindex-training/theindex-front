import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import en from '../../../../../public/i18n/en.json';
import { PageDriver, apiError, driver } from '../../../../testing/dom';
import { signInAs } from '../../../../testing/jwt';
import { CategoriesComponent } from './categories.component';
import { CategoryCreateComponent } from './category-create.component';
import { CategoryDeleteComponent } from './category-delete.component';
import { CategoryEditComponent } from './category-edit.component';

/** Article categories in the back office (decision record item 9): list, create, edit, delete. */

const URL = '/api/article-categories';
const NUTRITION = {
  id: 'c1',
  language: 'bg',
  name: 'Хранене',
  slug: 'hranene',
  description: 'Какво да ядем около тренировка.',
  sortOrder: 0,
};
const MOBILITY = {
  id: 'c2',
  language: 'bg',
  name: 'Мобилност',
  slug: 'mobilnost',
  description: null,
  sortOrder: 1,
};
const fields = en.content.categories.fields;

describe('article category pages', () => {
  let http: HttpTestingController;
  let router: Router;
  let harness: RouterTestingHarness;
  let page: PageDriver;

  beforeEach(async () => {
    localStorage.clear();
    signInAs('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'content/categories/new',
            component: CategoryCreateComponent,
          },
          {
            path: 'content/categories/:id/edit',
            component: CategoryEditComponent,
          },
          {
            path: 'content/categories/:id/delete',
            component: CategoryDeleteComponent,
          },
          { path: 'content/categories', component: CategoriesComponent },
          { path: 'missing-id/edit', component: CategoryEditComponent },
          { path: 'missing-id/delete', component: CategoryDeleteComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(url: string) {
    await harness.navigateByUrl(url);
    page = driver(
      () => harness.routeNativeElement!,
      () => harness.fixture.whenStable(),
    );
    await page.settle();
  }

  const value = (selector: string) =>
    page.query<HTMLInputElement | HTMLTextAreaElement>(selector)!.value;
  const button = (label: string) =>
    page
      .queryAll<HTMLButtonElement>('button')
      .find((candidate) => candidate.textContent?.trim() === label)!;
  /** flush() arguments for a NestJS-shaped error. */
  const errorBody = (message: string | undefined, status: number) => {
    const error = apiError(message, status);
    return [error.body, error.options] as const;
  };
  /** The JSON body as sent, so a key set to undefined counts as absent. */
  const sentBody = (method: string) => {
    const request = http.expectOne({ method, url: URL }).request;
    return JSON.parse(request.serializeBody() as string) as object;
  };

  describe('list', () => {
    it('lists the categories in the order the API sends, each linking to its edit page', async () => {
      await open('/content/categories');
      http.expectOne({ method: 'GET', url: URL }).flush([NUTRITION, MOBILITY]);
      await page.settle();

      expect(
        page.query('[data-testid="list-count"]')?.textContent?.trim(),
      ).toBe('2 categories');
      const rows = page.queryAll('tbody tr');
      expect(
        rows.map((row) =>
          row.querySelector('a.cell-link')?.textContent?.trim(),
        ),
      ).toEqual(['Хранене', 'Мобилност']);
      expect(rows[0].querySelector('a.cell-link')?.getAttribute('href')).toBe(
        '/content/categories/c1/edit',
      );
      // Slug, description (or a dash) and order.
      expect(rows[0].textContent).toContain('hranene');
      expect(rows[0].textContent).toContain('Какво да ядем около тренировка.');
      expect(rows[1].textContent).toContain('—');
      expect(
        rows.map((row) =>
          row.querySelector('.cell-right')?.textContent?.trim(),
        ),
      ).toEqual(['0', '1']);
    });

    it('offers to create the first category when there are none', async () => {
      await open('/content/categories');
      http.expectOne(URL).flush([]);
      await page.settle();

      expect(page.text()).toContain(en.content.categories.list.emptyTitle);
      expect(page.query('[data-testid="list-count"]')).toBeNull();
      const create = page
        .queryAll<HTMLAnchorElement>('a')
        .filter(
          (link) => link.getAttribute('href') === '/content/categories/new',
        );
      expect(create.length).toBeGreaterThan(0);
    });

    it('shows a load error and loads again on "Try again"', async () => {
      await open('/content/categories');
      http.expectOne(URL).flush(...errorBody(undefined, 500));
      await page.settle();

      expect(page.alert()).toContain(
        en.content.categories.list.loadErrorMessage,
      );
      button(en.common.tryAgain).click();
      http.expectOne(URL).flush([MOBILITY]);
      await page.settle();

      expect(page.alert()).toBeUndefined();
      expect(page.text()).toContain('Мобилност');
    });
  });

  describe('create', () => {
    it('sends nothing for an empty form and shows the name error', async () => {
      await open('/content/categories/new');
      await page.submit();

      http.expectNone(URL);
      expect(page.text()).toContain(fields.nameError);
    });

    it('sends only the name when the rest is left empty, so the API picks the slug and the order', async () => {
      await open('/content/categories/new');
      await page.type('#category-name', '  Силова подготовка  ');
      await page.type('#category-description', '   ');
      await page.submit();

      expect(sentBody('POST')).toEqual({ name: 'Силова подготовка' });
    });

    it('sends a chosen slug, description and order, trimmed, then returns to the list', async () => {
      await open('/content/categories/new');
      await page.type('#category-name', 'Хранене');
      await page.type('#category-slug', ' hranene-i-san ');
      await page.type('#category-description', ' За храната. ');
      await page.type('#category-order', '0');
      await page.submit();

      const request = http.expectOne({ method: 'POST', url: URL });
      expect(request.request.body).toEqual({
        name: 'Хранене',
        slug: 'hranene-i-san',
        description: 'За храната.',
        sortOrder: 0,
      });
      request.flush({ ...NUTRITION, slug: 'hranene-i-san' });
      await page.settle();

      expect(router.url).toBe('/content/categories');
      // The list loads again, with the change.
      http.expectOne({ method: 'GET', url: URL }).flush([]);
    });

    it.each([
      ['capitals', 'Hranene'],
      ['Cyrillic', 'хранене'],
      ['spaces', 'hranene i san'],
      ['a double hyphen', 'hranene--san'],
      ['a trailing hyphen', 'hranene-'],
      ['81 characters', 'a'.repeat(81)],
    ])('refuses a slug with %s', async (_, slug) => {
      await open('/content/categories/new');
      await page.type('#category-name', 'Хранене');
      await page.type('#category-slug', slug);
      await page.submit();

      http.expectNone(URL);
      expect(page.text()).toContain(fields.slugError);
    });

    it.each([
      ['a negative order', '#category-order', '-1', fields.sortOrderError],
      ['a fractional order', '#category-order', '1.5', fields.sortOrderError],
      [
        'a 61-character name',
        '#category-name',
        'а'.repeat(61),
        fields.nameError,
      ],
      ['a whitespace-only name', '#category-name', '   ', fields.nameError],
      [
        'a 301-character description',
        '#category-description',
        'а'.repeat(301),
        fields.descriptionError,
      ],
    ])('refuses %s', async (_, selector, input, error) => {
      await open('/content/categories/new');
      await page.type('#category-name', 'Хранене');
      await page.type(selector, input);
      await page.submit();

      http.expectNone(URL);
      expect(page.text()).toContain(error);
    });

    it('shows the API message for a clash and lets the admin try again', async () => {
      await open('/content/categories/new');
      await page.type('#category-name', 'хранене');
      await page.submit();

      http
        .expectOne({ method: 'POST', url: URL })
        .flush(...errorBody('A category named "Хранене" already exists', 409));
      await page.settle();

      expect(page.alert()).toBe('A category named "Хранене" already exists');
      expect(button(en.content.categories.create.submit).disabled).toBe(false);
      expect(router.url).toBe('/content/categories/new');
    });
  });

  describe('edit', () => {
    /** Opens /content/categories/c2/edit, loading `category` as c2. */
    async function openEdit(category: object = MOBILITY) {
      await open('/content/categories/c2/edit');
      http
        .expectOne({ method: 'GET', url: `${URL}/c2` })
        .flush({ ...category, id: 'c2' });
      await page.settle();
    }

    it('fills the form from the category', async () => {
      await openEdit(NUTRITION);

      expect(value('#category-name')).toBe('Хранене');
      expect(value('#category-slug')).toBe('hranene');
      expect(value('#category-description')).toBe(
        'Какво да ядем около тренировка.',
      );
      expect(value('#category-order')).toBe('0');
    });

    it('sends every field, an emptied description as null, then returns to the list', async () => {
      await openEdit(NUTRITION);
      await page.type('#category-name', ' Хранене и сън ');
      await page.type('#category-slug', 'hranene-i-san');
      await page.type('#category-description', '');
      await page.type('#category-order', '3');
      await page.submit();

      const request = http.expectOne({ method: 'PATCH', url: `${URL}/c2` });
      expect(JSON.parse(request.request.serializeBody() as string)).toEqual({
        name: 'Хранене и сън',
        slug: 'hranene-i-san',
        description: null,
        sortOrder: 3,
      });
      request.flush(NUTRITION);
      await page.settle();

      expect(router.url).toBe('/content/categories');
      // The list loads again, with the change.
      http.expectOne({ method: 'GET', url: URL }).flush([]);
    });

    it('requires the slug and the order', async () => {
      await openEdit();
      await page.type('#category-slug', '');
      await page.type('#category-order', '');
      await page.submit();

      http.expectNone(`${URL}/c2`);
      expect(page.text()).toContain(fields.slugRequired);
      expect(page.text()).toContain(fields.sortOrderError);
    });

    it('shows why a slug change was refused and keeps the form', async () => {
      await openEdit(NUTRITION);
      await page.type('#category-slug', 'hrana');
      await page.submit();

      http
        .expectOne({ method: 'PATCH', url: `${URL}/c2` })
        .flush(
          ...errorBody(
            "The slug can't change while published articles use this category",
            409,
          ),
        );
      await page.settle();

      expect(page.alert()).toBe(
        "The slug can't change while published articles use this category",
      );
      expect(value('#category-slug')).toBe('hrana');
      expect(button(en.common.saveChanges).disabled).toBe(false);
    });

    it('links to the delete page', async () => {
      await openEdit();

      const link = page
        .queryAll<HTMLAnchorElement>('a')
        .find(
          (candidate) =>
            candidate.textContent?.trim() === en.content.categories.edit.delete,
        );
      expect(link?.getAttribute('href')).toBe('/content/categories/c2/delete');
    });

    it('shows the API message when the category cannot be loaded', async () => {
      await open('/content/categories/c2/edit');
      http
        .expectOne(`${URL}/c2`)
        .flush(...errorBody('Category not found', 404));
      await page.settle();

      expect(page.alert()).toBe('Category not found');
      expect(page.query('form')).toBeNull();
    });

    it('sends nothing without an id', async () => {
      await open('/missing-id/edit');

      expect(page.alert()).toBe(en.content.categories.errors.missingId);
    });
  });

  describe('delete', () => {
    async function openDelete() {
      await open('/content/categories/c1/delete');
      http.expectOne({ method: 'GET', url: `${URL}/c1` }).flush(NUTRITION);
      await page.settle();
    }

    it('shows the category and what deleting it does', async () => {
      await openDelete();

      expect(page.text()).toContain('Хранене');
      expect(page.text()).toContain('hranene');
      expect(page.text()).toContain(en.content.categories.delete.warning);
    });

    it('deletes it and returns to the list', async () => {
      await openDelete();
      await page.click('.btn--danger-solid');

      http
        .expectOne({ method: 'DELETE', url: `${URL}/c1` })
        .flush({ deleted: true });
      await page.settle();

      expect(router.url).toBe('/content/categories');
      // The list loads again, with the change.
      http.expectOne({ method: 'GET', url: URL }).flush([]);
    });

    it('shows a failed delete and gives the button back', async () => {
      await openDelete();
      await page.click('.btn--danger-solid');

      http
        .expectOne({ method: 'DELETE', url: `${URL}/c1` })
        .flush(...errorBody(undefined, 500));
      await page.settle();

      expect(page.alert()).toBe(en.content.categories.delete.error);
      expect(button(en.content.categories.delete.submit).disabled).toBe(false);
      expect(router.url).toBe('/content/categories/c1/delete');
    });

    it('sends nothing without an id', async () => {
      await open('/missing-id/delete');

      expect(page.alert()).toBe(en.content.categories.errors.missingId);
    });
  });
});
