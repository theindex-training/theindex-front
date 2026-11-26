import { YearInReview } from '../services/trainees.service';
import { MIN_STREAK_WEEKS } from './year-in-review';

/**
 * The year in review's share image: a 1080×1920 story picture (Instagram's and WhatsApp's size)
 * drawn on a canvas in the browser, in the story's dark look. Nothing is uploaded: the person
 * shares or saves it themselves.
 */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

/** The rows under the big figure: what the year has, as on the story's summary. */
export type ShareRow = 'time' | 'streak' | 'trainer' | 'month';

export function shareRows(review: YearInReview): ShareRow[] {
  const rows: ShareRow[] = [];
  if (review.favouriteTime) {
    rows.push('time');
  }
  if (review.longestStreakWeeks >= MIN_STREAK_WEEKS) {
    rows.push('streak');
  }
  if (review.topTrainer) {
    rows.push('trainer');
  }
  if (review.busiestMonth) {
    rows.push('month');
  }
  return rows;
}

export function shareFileName(year: number): string {
  return `the-index-${year}.png`;
}

/** The image's text, already translated. */
export interface YearShareContent {
  kicker: string;
  figure: string;
  figureLabel: string;
  rows: { label: string; value: string }[];
  outro: string;
  site: string;
}

/** The design tokens it is drawn in (read from the page, so it matches the app). */
export interface YearShareStyle {
  background: string;
  text: string;
  strong: string;
  gold: string;
  border: string;
  /** The confetti's colors. */
  sparkles: string[];
  headingFont: string;
  bodyFont: string;
}

/** A logo to draw at the top (640×270 artwork), or none when it couldn't be loaded. */
export interface ShareLogo {
  image: CanvasImageSource;
  width: number;
  height: number;
}

const MARGIN = 96;
/** A value smaller than this beside its label goes on its own line instead. */
const MIN_BESIDE_SIZE = 40;

/**
 * Sets the largest font size (down to `min`) at which the text fits `maxWidth`, and answers the
 * text to draw: cut with "…" when it doesn't fit even at `min`.
 */
function fit(
  context: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  size: number,
  maxWidth: number,
  min = 28,
): string {
  let current = size;
  context.font = font(current);
  while (current > min && context.measureText(text).width > maxWidth) {
    current -= 2;
    context.font = font(current);
  }
  let shown = text;
  while (shown.length > 1 && context.measureText(shown).width > maxWidth) {
    shown = `${shown.slice(0, -2).trimEnd()}…`;
  }
  return shown;
}

/** Sparkles scattered over the top, the same every time (no randomness in the picture). */
function sparkles(context: CanvasRenderingContext2D, colors: string[]): void {
  if (!colors.length) {
    return;
  }
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 36; i++) {
    const x = next() * SHARE_WIDTH;
    const y = 40 + next() * 520;
    const r = 3 + next() * 7;
    context.globalAlpha = 0.35 + next() * 0.5;
    context.fillStyle = colors[i % colors.length];
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

/** Draws the whole picture. */
export function drawYearShare(
  context: CanvasRenderingContext2D,
  content: YearShareContent,
  style: YearShareStyle,
  logo: ShareLogo | null,
): void {
  const heading = (weight: number) => (size: number) =>
    `${weight} ${size}px ${style.headingFont}`;
  const body = (weight: number) => (size: number) =>
    `${weight} ${size}px ${style.bodyFont}`;
  const inner = SHARE_WIDTH - 2 * MARGIN;
  const center = SHARE_WIDTH / 2;

  context.fillStyle = style.background;
  context.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  sparkles(context, style.sparkles);

  context.textBaseline = 'alphabetic';
  context.textAlign = 'center';

  if (logo) {
    const height = 170;
    const width = (logo.width / logo.height) * height;
    context.drawImage(logo.image, center - width / 2, 150, width, height);
  }

  context.fillStyle = style.text;
  context.letterSpacing = '6px';
  context.fillText(
    fit(context, content.kicker, heading(600), 56, inner),
    center,
    470,
  );

  context.fillStyle = style.gold;
  context.letterSpacing = '0px';
  context.fillText(
    fit(context, content.figure, heading(700), 380, inner),
    center,
    840,
  );

  context.fillStyle = style.strong;
  context.fillText(
    fit(context, content.figureLabel, body(500), 64, inner),
    center,
    940,
  );

  // The rows: the label on the left and the value on the right, or on a line of its own under
  // the label when it would get small beside it (a long name); a line under each.
  let y = 1080;
  for (const row of content.rows) {
    context.textAlign = 'left';
    context.fillStyle = style.text;
    context.letterSpacing = '4px';
    const label = fit(context, row.label, heading(600), 40, inner * 0.5);
    context.fillText(label, MARGIN, y);
    const besideWidth = inner - context.measureText(label).width - 48;

    context.textAlign = 'right';
    context.fillStyle = style.strong;
    context.letterSpacing = '0px';
    context.font = body(600)(MIN_BESIDE_SIZE);
    const beside = context.measureText(row.value).width <= besideWidth;
    if (!beside) {
      y += 64;
    }
    context.fillText(
      fit(context, row.value, body(600), 54, beside ? besideWidth : inner),
      SHARE_WIDTH - MARGIN,
      y,
    );

    context.fillStyle = style.border;
    context.fillRect(MARGIN, y + 36, inner, 3);
    y += 124;
  }

  context.textAlign = 'center';
  context.fillStyle = style.strong;
  context.fillText(
    fit(context, content.outro, body(500), 46, inner),
    center,
    1750,
  );

  context.fillStyle = style.gold;
  context.letterSpacing = '4px';
  context.fillText(
    fit(context, content.site, heading(700), 44, inner),
    center,
    1830,
  );
  context.letterSpacing = '0px';
}
