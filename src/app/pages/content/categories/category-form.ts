import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  CreateArticleCategoryPayload,
  UpdateArticleCategoryPayload,
} from '../../../services/article-categories.service';
import { trimmedLength } from '../../../utils/form-validators.util';

/** Limits from theindex-api's category DTOs (article-categories/dto/category-fields.ts). */
export const CATEGORY_NAME_MAX = 60;
export const CATEGORY_DESCRIPTION_MAX = 300;
export const CATEGORY_SLUG_MAX = 80;
/** The API's SLUG_PATTERN: lowercase Latin letters and digits joined by single hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CategoryFormMode = 'create' | 'edit';

export type CategoryForm = FormGroup<{
  name: FormControl<string>;
  slug: FormControl<string>;
  description: FormControl<string>;
  sortOrder: FormControl<number | null>;
}>;

/** A slug as the API accepts it, checked after trimming (the API trims too). Empty passes. */
function slugFormat(control: AbstractControl): ValidationErrors | null {
  const value = ((control.value as string | null) ?? '').trim();
  if (!value) {
    return null;
  }
  return value.length <= CATEGORY_SLUG_MAX && SLUG_PATTERN.test(value)
    ? null
    : { slug: true };
}

/** A whole number, 0 or more. Empty (null) passes. */
const wholeNumber: ValidatorFn = (control) => {
  const value = control.value as number | null;
  if (value === null || value === undefined) {
    return null;
  }
  return Number.isInteger(value) && value >= 0 ? null : { wholeNumber: true };
};

/**
 * The fields of the create and edit pages. On create, the slug and the order may stay empty (the
 * API makes the slug from the name and puts the category last); on edit both are required.
 */
export function buildCategoryForm(
  formBuilder: FormBuilder,
  mode: CategoryFormMode,
): CategoryForm {
  const requiredOnEdit = mode === 'edit' ? [Validators.required] : [];
  return formBuilder.group({
    name: formBuilder.nonNullable.control('', [
      Validators.required,
      trimmedLength(1, CATEGORY_NAME_MAX),
    ]),
    slug: formBuilder.nonNullable.control('', [...requiredOnEdit, slugFormat]),
    description: formBuilder.nonNullable.control('', [
      trimmedLength(0, CATEGORY_DESCRIPTION_MAX),
    ]),
    sortOrder: formBuilder.control<number | null>(null, [
      ...requiredOnEdit,
      wholeNumber,
    ]),
  });
}

/** Text is trimmed; an empty slug, description or order is left out, so the API's defaults apply. */
export function createCategoryPayload(
  form: CategoryForm,
): CreateArticleCategoryPayload {
  const raw = form.getRawValue();
  const payload: CreateArticleCategoryPayload = { name: raw.name.trim() };
  const slug = raw.slug.trim();
  const description = raw.description.trim();
  if (slug) {
    payload.slug = slug;
  }
  if (description) {
    payload.description = description;
  }
  if (raw.sortOrder !== null) {
    payload.sortOrder = raw.sortOrder;
  }
  return payload;
}

/** Every field, trimmed; an empty description is sent as null, which removes it. */
export function updateCategoryPayload(
  form: CategoryForm,
): UpdateArticleCategoryPayload {
  const raw = form.getRawValue();
  const payload: UpdateArticleCategoryPayload = {
    name: raw.name.trim(),
    slug: raw.slug.trim(),
    description: raw.description.trim() || null,
  };
  if (raw.sortOrder !== null) {
    payload.sortOrder = raw.sortOrder;
  }
  return payload;
}
