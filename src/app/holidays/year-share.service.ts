import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import {
  SHARE_HEIGHT,
  SHARE_WIDTH,
  ShareLogo,
  YearShareContent,
  YearShareStyle,
  drawYearShare,
} from './year-share-image';

/** The logo drawn at the top of the picture (same origin, so the canvas stays exportable). */
const LOGO_PATH = 'brand/the-index-logo-red.png';

/** The confetti tokens, as in the holiday layer. */
const SPARKLE_TOKENS = [
  '--holiday-gold',
  '--holiday-red',
  '--holiday-green',
  '--snow-fill',
];

export type ShareOutcome = 'shared' | 'saved' | 'cancelled';

/**
 * Makes the year in review's picture and hands it on: to the device's share sheet where the
 * browser can share files (phones), else as a download. Everything happens in the browser.
 */
@Injectable({ providedIn: 'root' })
export class YearShareService {
  private readonly document = inject(DOCUMENT);

  /** The picture as a PNG file; rejects when the browser can't draw it. */
  async makeImage(content: YearShareContent, fileName: string): Promise<File> {
    const canvas = this.document.createElement('canvas');
    canvas.width = SHARE_WIDTH;
    canvas.height = SHARE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No canvas');
    }
    const style = this.style();
    await this.loadFonts(style, content);
    const logo = await this.loadLogo();
    drawYearShare(context, content, style, logo);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (!blob) {
      throw new Error('No image');
    }
    return new File([blob], fileName, { type: 'image/png' });
  }

  /**
   * Shares the file where the browser can share files, else saves it. Closing the share sheet
   * is no error; a share the browser refuses (e.g. the tap's activation ran out) saves instead.
   */
  async shareOrSave(
    file: File,
    title: string,
    text: string,
  ): Promise<ShareOutcome> {
    const navigator = this.document.defaultView?.navigator;
    const data: ShareData = { files: [file], title, text };
    if (navigator?.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return 'shared';
      } catch (error) {
        if ((error as DOMException | null)?.name === 'AbortError') {
          return 'cancelled';
        }
      }
    }
    this.save(file);
    return 'saved';
  }

  private save(file: File): void {
    const view = this.document.defaultView;
    const url = URL.createObjectURL(file);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.rel = 'noopener';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    // Some browsers read the address after the click returns.
    view?.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  private style(): YearShareStyle {
    const view = this.document.defaultView;
    const computed = view?.getComputedStyle(this.document.documentElement);
    const token = (name: string) =>
      computed?.getPropertyValue(name).trim() ?? '';
    return {
      background: token('--nav-bg'),
      text: token('--nav-text'),
      strong: token('--nav-text-strong'),
      gold: token('--holiday-gold'),
      border: token('--nav-border'),
      sparkles: SPARKLE_TOKENS.map(token).filter(Boolean),
      headingFont: token('--font-heading') || 'sans-serif',
      bodyFont: token('--font-body') || 'sans-serif',
    };
  }

  /** The page's fonts, with the subsets the text needs (Cyrillic for Bulgarian). */
  private async loadFonts(
    style: YearShareStyle,
    content: YearShareContent,
  ): Promise<void> {
    const fonts = this.document.fonts as FontFaceSet | undefined;
    if (!fonts?.load) {
      return;
    }
    const text = [
      content.kicker,
      content.figure,
      content.figureLabel,
      content.outro,
      content.site,
      ...content.rows.flatMap((row) => [row.label, row.value]),
    ].join(' ');
    try {
      await Promise.all([
        fonts.load(`700 100px ${style.headingFont}`, text),
        fonts.load(`600 100px ${style.headingFont}`, text),
        fonts.load(`500 100px ${style.bodyFont}`, text),
        fonts.load(`600 100px ${style.bodyFont}`, text),
      ]);
    } catch {
      // The fallback fonts draw it too.
    }
  }

  /** The logo, or null when it can't be loaded (the picture has no logo then). */
  private async loadLogo(): Promise<ShareLogo | null> {
    try {
      const response = await fetch(LOGO_PATH);
      if (!response.ok) {
        return null;
      }
      const image = await createImageBitmap(await response.blob());
      return { image, width: image.width, height: image.height };
    } catch {
      return null;
    }
  }
}
