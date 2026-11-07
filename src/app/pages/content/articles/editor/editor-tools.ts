import type {
  BlockAPI,
  BlockTool,
  BlockToolConstructorOptions,
  PasteEvent,
  ToolboxConfig,
} from '@editorjs/editorjs';
import EditorjsList from '@editorjs/list';
import Quote from '@editorjs/quote';
import { Media, mediaThumbnail } from '../../../../services/media.service';
import { YOUTUBE_LINK_PATTERN, youtubeVideoId } from './article-content';

/**
 * Editor.js tools for the article editor, limited to what theindex-api stores
 * (theindex-web docs/decision-record.md, section 7). Text comes in already translated (`labels`),
 * because tools are plain classes outside Angular.
 */

/** Inline HTML a caption may keep: the API's allowlist. */
const INLINE_SANITIZE = { b: true, i: true, a: { href: true }, br: true };

// Lucide-style icons (24px grid, 2px round strokes, currentColor), as in app-icon.
const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const IMAGE_ICON = svg(
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
);
const VIDEO_ICON = svg(
  '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
);

/** The list tool without checklists, start numbers or counter types: the API keeps none of them. */
export class ArticleListTool extends EditorjsList {
  static override get toolbox(): ToolboxConfig {
    const entries = EditorjsList.toolbox;
    return (Array.isArray(entries) ? entries : [entries]).filter(
      (entry) =>
        (entry.data as { style?: string } | undefined)?.style !== 'checklist',
    );
  }

  override renderSettings() {
    // The first two items switch between unordered and ordered.
    return super.renderSettings().slice(0, 2);
  }
}

/** The quote tool without alignment, which the API doesn't keep. */
export class ArticleQuoteTool extends Quote {
  override renderSettings() {
    return [];
  }
}

export interface ImageToolLabels {
  choose: string;
  replace: string;
  caption: string;
  missing: string;
  altText: string;
}

export interface ImageToolConfig {
  labels: ImageToolLabels;
  /** Opens the media picker; null when the admin closed it. */
  pick: () => Promise<Media | null>;
  /** The image for an id, or null when it no longer exists. */
  resolve: (id: string) => Promise<Media | null>;
}

interface ImageData {
  mediaId?: string;
  caption?: string;
}

/**
 * An image from the media library, stored as `{ mediaId, caption }`. Inserting one opens the
 * media picker; the image itself comes from the library, never from a pasted URL.
 */
export class ArticleImageTool implements BlockTool {
  static get toolbox(): ToolboxConfig {
    return { title: 'Image', icon: IMAGE_ICON };
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }

  static get sanitize() {
    return { caption: INLINE_SANITIZE };
  }

  private mediaId: string | undefined;
  private readonly config: ImageToolConfig;
  private readonly block: BlockAPI;
  private readonly readOnly: boolean;
  private readonly wrapper = document.createElement('div');
  private readonly preview = document.createElement('div');
  private readonly caption = document.createElement('div');

  constructor({
    data,
    config,
    block,
    readOnly,
  }: BlockToolConstructorOptions<ImageData, ImageToolConfig>) {
    this.mediaId = data.mediaId;
    this.config = config!;
    this.block = block;
    this.readOnly = readOnly;

    this.wrapper.className = 'cdx-block article-block article-block--image';
    this.preview.className = 'article-block__media';
    this.caption.className = 'cdx-input article-block__caption';
    this.caption.contentEditable = readOnly ? 'false' : 'true';
    this.caption.dataset['placeholder'] = this.config.labels.caption;
    this.caption.innerHTML = data.caption ?? '';
    this.wrapper.append(this.preview, this.caption);
  }

  render(): HTMLElement {
    this.showImage();
    return this.wrapper;
  }

  /** A new, empty image block goes straight to the picker. */
  rendered(): void {
    if (!this.mediaId && !this.readOnly) {
      void this.choose();
    }
  }

  renderSettings() {
    return [
      {
        icon: IMAGE_ICON,
        label: this.config.labels.replace,
        closeOnActivate: true,
        onActivate: () => void this.choose(),
      },
    ];
  }

  save(): ImageData {
    return { mediaId: this.mediaId, caption: this.caption.innerHTML };
  }

  /** A block without an image is left out of the saved content. */
  validate(data: ImageData): boolean {
    return !!data.mediaId;
  }

  private async choose(): Promise<void> {
    const media = await this.config.pick();
    if (!media) return;
    this.mediaId = media.id;
    this.showMedia(media);
    this.block.dispatchChange();
  }

  private showImage(): void {
    this.preview.replaceChildren();
    if (!this.mediaId) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--secondary';
      button.textContent = this.config.labels.choose;
      button.disabled = this.readOnly;
      button.addEventListener('click', () => void this.choose());
      this.preview.append(button);
      return;
    }
    const id = this.mediaId;
    void this.config.resolve(id).then((media) => {
      if (id !== this.mediaId) return;
      if (media) {
        this.showMedia(media);
      } else {
        const missing = document.createElement('p');
        missing.className = 'notice notice--warning';
        missing.textContent = this.config.labels.missing;
        this.preview.replaceChildren(missing);
      }
    });
  }

  private showMedia(media: Media): void {
    const image = document.createElement('img');
    image.className = 'article-block__image';
    image.src = mediaThumbnail(media, 960);
    image.alt = media.altText;
    image.width = media.width;
    image.height = media.height;
    const alt = document.createElement('p');
    alt.className = 'article-block__note';
    alt.textContent = `${this.config.labels.altText}: ${media.altText}`;
    this.preview.replaceChildren(image, alt);
  }
}

export interface VideoToolLabels {
  link: string;
  linkHint: string;
  invalidLink: string;
  caption: string;
  thumbnail: string;
  open: string;
}

export interface VideoToolConfig {
  labels: VideoToolLabels;
}

interface VideoData {
  service?: 'youtube';
  videoId?: string;
  caption?: string;
}

let videoFieldId = 0;

/**
 * A YouTube video, stored as `{ service: 'youtube', videoId, caption }` under the tool name
 * `embed`. Made by pasting a YouTube link into the editor, or from the toolbox with a link field.
 * The back office shows the video's thumbnail; the public site loads the player on click.
 */
export class ArticleVideoTool implements BlockTool {
  static get toolbox(): ToolboxConfig {
    return { title: 'Video', icon: VIDEO_ICON };
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }

  static get sanitize() {
    return { caption: INLINE_SANITIZE };
  }

  static get pasteConfig() {
    return { patterns: { youtube: YOUTUBE_LINK_PATTERN } };
  }

  private videoId: string | undefined;
  private readonly labels: VideoToolLabels;
  private readonly block: BlockAPI;
  private readonly readOnly: boolean;
  private readonly wrapper = document.createElement('div');
  private readonly body = document.createElement('div');
  private readonly caption = document.createElement('div');

  constructor({
    data,
    config,
    block,
    readOnly,
  }: BlockToolConstructorOptions<VideoData, VideoToolConfig>) {
    this.videoId = data.videoId;
    this.labels = config!.labels;
    this.block = block;
    this.readOnly = readOnly;

    this.wrapper.className = 'cdx-block article-block article-block--video';
    this.caption.className = 'cdx-input article-block__caption';
    this.caption.contentEditable = readOnly ? 'false' : 'true';
    this.caption.dataset['placeholder'] = this.labels.caption;
    this.caption.innerHTML = data.caption ?? '';
    this.wrapper.append(this.body, this.caption);
  }

  render(): HTMLElement {
    if (this.videoId) {
      this.showVideo(this.videoId);
    } else {
      this.showLinkField();
    }
    return this.wrapper;
  }

  onPaste(event: PasteEvent): void {
    const link = (event.detail as { data?: unknown }).data;
    const id = typeof link === 'string' ? youtubeVideoId(link) : null;
    if (id) {
      this.videoId = id;
      this.showVideo(id);
    }
  }

  save(): VideoData {
    return {
      service: 'youtube',
      videoId: this.videoId,
      caption: this.caption.innerHTML,
    };
  }

  /** A block without a video is left out of the saved content. */
  validate(data: VideoData): boolean {
    return !!data.videoId;
  }

  private showLinkField(): void {
    const id = `article-video-link-${videoFieldId++}`;
    const field = document.createElement('div');
    field.className = 'form-field';
    const label = document.createElement('label');
    label.className = 'form-field__label';
    label.htmlFor = id;
    label.textContent = this.labels.link;
    const input = document.createElement('input');
    input.id = id;
    input.type = 'url';
    input.inputMode = 'url';
    input.autocomplete = 'off';
    input.placeholder = 'https://www.youtube.com/watch?v=…';
    input.disabled = this.readOnly;
    input.setAttribute('aria-describedby', `${id}-help`);
    const help = document.createElement('span');
    help.id = `${id}-help`;
    help.className = 'form-field__hint';
    help.textContent = this.labels.linkHint;
    field.append(label, input, help);

    const accept = () => {
      const value = input.value.trim();
      if (!value) return;
      const videoId = youtubeVideoId(value);
      if (!videoId) {
        input.setAttribute('aria-invalid', 'true');
        help.className = 'form-field__error';
        help.textContent = this.labels.invalidLink;
        return;
      }
      this.videoId = videoId;
      this.showVideo(videoId);
      this.block.dispatchChange();
    };
    input.addEventListener('change', accept);
    input.addEventListener('keydown', (event) => {
      // Editor.js would otherwise make a new block on Enter.
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        accept();
      }
    });
    // Editor.js handles paste in its blocks; the link field takes plain text.
    input.addEventListener('paste', (event) => event.stopPropagation());
    this.body.replaceChildren(field);
    if (!this.readOnly) {
      queueMicrotask(() => input.focus());
    }
  }

  private showVideo(videoId: string): void {
    const image = document.createElement('img');
    image.className = 'article-block__image';
    image.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    image.alt = this.labels.thumbnail;
    image.width = 480;
    image.height = 360;
    const link = document.createElement('a');
    link.className = 'article-block__note';
    link.href = `https://www.youtube.com/watch?v=${videoId}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = this.labels.open;
    this.body.replaceChildren(image, link);
  }
}
