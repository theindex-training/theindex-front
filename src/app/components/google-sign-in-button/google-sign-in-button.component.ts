import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../../i18n/language.service';
import {
  GoogleAccountsId,
  GoogleSignInService,
} from '../../services/google-sign-in.service';
import { ThemeService } from '../../services/theme.service';

/** Google's button is 200–400px wide; it fills the card up to that. */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

/**
 * "Sign in with Google" under the login form: an "or" divider, Google's own button (drawn by
 * Google Identity Services in Google's style, in the page's language and theme) and a hint that it
 * opens the account with the same email. Nothing shows while the API has no Google client id or
 * Google's script can't load (e.g. blocked): the password login is always there.
 *
 * Built on signals (the SDK, the language and the theme), so it keeps the OnPush default.
 */
@Component({
  selector: 'app-google-sign-in-button',
  standalone: true,
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <p class="google-sign-in__or">
        <span>{{ 'auth.login.or' | transloco }}</span>
      </p>
    }
    <div
      #button
      class="google-sign-in__button"
      data-testid="google-sign-in"
      [class.is-busy]="busy()"
      [attr.aria-busy]="busy() || null"
    ></div>
    @if (ready()) {
      <p class="google-sign-in__hint">
        {{ 'auth.login.google.hint' | transloco }}
      </p>
    }
  `,
  styleUrl: './google-sign-in-button.component.scss',
})
export class GoogleSignInButtonComponent {
  private readonly google = inject(GoogleSignInService);
  private readonly language = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private readonly container =
    viewChild.required<ElementRef<HTMLElement>>('button');
  private readonly sdk = signal<GoogleAccountsId | null>(null);

  /** A sign-in is being checked: the button doesn't take another click meanwhile. */
  readonly busy = input(false);
  /** The Google ID token of a completed sign-in, for `AuthService.loginWithGoogle`. */
  readonly credential = output<string>();

  readonly ready = computed(() => this.sdk() !== null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    destroyRef.onDestroy(() => (destroyed = true));

    this.google
      .clientId()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (clientId) => {
          if (!clientId) return;
          this.google.load(clientId).then(
            (sdk) => {
              if (!destroyed) this.sdk.set(sdk);
            },
            () => undefined,
          );
        },
        error: () => undefined,
      });

    this.google.credential$
      .pipe(takeUntilDestroyed())
      .subscribe((credential) => this.credential.emit(credential));

    // Google draws the button with its label in a fixed language and theme: draw it again on a
    // switch.
    effect(() => {
      const sdk = this.sdk();
      if (!sdk) return;
      const element = this.container().nativeElement;
      const width = element.clientWidth || MAX_WIDTH;
      element.replaceChildren();
      sdk.renderButton(element, {
        type: 'standard',
        theme:
          this.theme.resolvedTheme() === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(width))),
        locale: this.language.lang(),
      });
    });
  }
}
