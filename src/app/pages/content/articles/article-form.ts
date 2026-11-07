import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
} from '@angular/forms';
import { ArticleDraft } from '../../../services/articles.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** Limits from theindex-api's article DTOs (articles/dto/article-fields.ts, common/utils/slug.util.ts). */
export const ARTICLE_TITLE_MAX = 200;
export const ARTICLE_EXCERPT_MAX = 300;
export const ARTICLE_SEO_TITLE_MAX = 70;
export const ARTICLE_SEO_DESCRIPTION_MAX = 160;
export const ARTICLE_SLUG_MAX = 80;
export const ARTICLE_MAX_CATEGORIES = 10;
/** The API's SLUG_PATTERN: lowercase Latin letters and digits joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The editor's text fields; categories and the featured image are kept by the page. */
export type ArticleTextForm = FormGroup<{
  title: FormControl<string>;
  slug: FormControl<string>;
  excerpt: FormControl<string>;
  seoTitle: FormControl<string>;
  seoDescription: FormControl<string>;
}>;

export type ArticleTextField = keyof ArticleTextForm['controls'];

/** A chosen slug as the API accepts it, checked after trimming. Empty passes. */
function slugFormat(control: AbstractControl): ValidationErrors | null {
  const value = ((control.value as string | null) ?? '').trim();
  if (!value) {
    return null;
  }
  return value.length <= ARTICLE_SLUG_MAX && SLUG_PATTERN.test(value)
    ? null
    : { slug: true };
}

/**
 * Drafts may be incomplete (an empty title included): only the lengths the API checks on every
 * save, and the slug's format, are enforced here. The rules for going live are checked on publish.
 */
export function buildArticleTextForm(
  formBuilder: FormBuilder,
  draft: ArticleDraft,
): ArticleTextForm {
  return formBuilder.nonNullable.group({
    title: [draft.title, [trimmedLength(0, ARTICLE_TITLE_MAX)]],
    slug: [draft.slug ?? '', [slugFormat]],
    excerpt: [draft.excerpt ?? '', [trimmedLength(0, ARTICLE_EXCERPT_MAX)]],
    seoTitle: [draft.seoTitle ?? '', [trimmedLength(0, ARTICLE_SEO_TITLE_MAX)]],
    seoDescription: [
      draft.seoDescription ?? '',
      [trimmedLength(0, ARTICLE_SEO_DESCRIPTION_MAX)],
    ],
  });
}

/**
 * The value autosave sends for a text field: trimmed; the title as a string, the optional fields
 * as null when empty (which clears them). Undefined when the field has an error.
 */
export function textFieldChange(
  form: ArticleTextForm,
  field: ArticleTextField,
): string | null | undefined {
  const control = form.controls[field];
  if (control.invalid) {
    return undefined;
  }
  const value = control.value.trim();
  return field === 'title' ? value : value || null;
}
