import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { apiErrorMessage, UiMessage } from '../../../i18n/ui-message';
import { UiMessagePipe } from '../../../i18n/ui-message.pipe';
import { ArticlesService } from '../../../services/articles.service';
import { trimmedLength } from '../../../utils/form-validators.util';
import { ARTICLE_TITLE_MAX } from './article-form';

/**
 * "New article": the title first, because the API creates a draft with one; then the editor
 * opens on the new draft (and Back skips this page).
 */
@Component({
  selector: 'app-article-create',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    UiMessagePipe,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './article-create.component.html',
})
export class ArticleCreateComponent {
  readonly form: FormGroup<{ title: FormControl<string> }>;
  submitting = false;
  errorMessage: UiMessage | null = null;

  constructor(
    formBuilder: FormBuilder,
    private readonly articlesService: ArticlesService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {
    this.form = formBuilder.nonNullable.group({
      title: ['', [Validators.required, trimmedLength(1, ARTICLE_TITLE_MAX)]],
    });
  }

  get titleInvalid(): boolean {
    const control = this.form.controls.title;
    return control.invalid && control.touched;
  }

  handleSubmit(): void {
    if (this.submitting) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    this.articlesService
      .create(this.form.controls.title.value.trim())
      .subscribe({
        next: (article) => {
          this.submitting = false;
          void this.router.navigate(['/content/articles', article.id], {
            replaceUrl: true,
          });
        },
        error: (error) => {
          this.errorMessage = apiErrorMessage(
            error,
            'content.articles.create.error',
          );
          this.submitting = false;
          this.changeDetector.detectChanges();
        },
      });
  }
}
