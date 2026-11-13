import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../../components/icon/icon.component';
import { youtubeVideoId } from '../../utils/youtube.util';

/**
 * An exercise's YouTube video on the training page: its thumbnail and a play button, replaced by
 * the player (youtube-nocookie.com) once played, so a workout with many exercises loads no
 * players up front. A link that isn't YouTube's shows as a plain link.
 */
@Component({
  selector: 'app-exercise-video',
  standalone: true,
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (videoId) {
      <div class="video">
        @if (player) {
          <iframe
            class="video__frame"
            [src]="player"
            [title]="'traineeTraining.videoTitle' | transloco: { name }"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        } @else {
          <button
            class="video__poster"
            type="button"
            data-testid="exercise-video-play"
            [attr.aria-label]="
              'traineeTraining.playVideo' | transloco: { name }
            "
            (click)="play()"
          >
            @if (!thumbFailed) {
              <img
                class="video__thumb"
                [src]="'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg'"
                alt=""
                width="480"
                height="360"
                loading="lazy"
                (error)="thumbFailed = true"
              />
            }
            <span class="video__play"><app-icon name="play" /></span>
          </button>
        }
      </div>
    }
    <a
      class="video__link"
      [href]="url"
      target="_blank"
      rel="noopener noreferrer"
      >{{ 'traineeTraining.openVideo' | transloco }}</a
    >
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-2);
    }

    .video {
      position: relative;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-lg);
      background: var(--nav-bg);
    }

    .video__frame,
    .video__poster,
    .video__thumb {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .video__poster {
      padding: 0;
      background: none;
      cursor: pointer;
    }

    .video__thumb {
      object-fit: cover;
    }

    .video__play {
      position: absolute;
      top: 50%;
      left: 50%;
      display: grid;
      place-items: center;
      width: 4rem;
      height: 4rem;
      border-radius: var(--radius-pill);
      background: var(--accent);
      color: var(--on-accent);
      transform: translate(-50%, -50%);
      --icon-size: 1.75rem;
    }

    .video__poster:hover .video__play,
    .video__poster:focus-visible .video__play {
      outline: 3px solid var(--on-accent);
    }

    .video__link {
      justify-self: start;
      font-size: var(--text-sm);
    }
  `,
})
export class ExerciseVideoComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** The exercise's name, for the button and the player's title. */
  @Input({ required: true }) name!: string;

  private link = '';
  videoId: string | null = null;
  player: SafeResourceUrl | null = null;
  /** No thumbnail (offline, or the video is gone): the dark poster and its button stay. */
  thumbFailed = false;

  @Input({ required: true })
  set url(value: string) {
    this.link = value;
    this.videoId = youtubeVideoId(value);
    this.player = null;
    this.thumbFailed = false;
  }
  get url(): string {
    return this.link;
  }

  play(): void {
    // The id passed youtubeVideoId's check (11 letters, digits, "-" or "_"), so the address is ours.
    this.player = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${this.videoId}?autoplay=1&rel=0`,
    );
  }
}
