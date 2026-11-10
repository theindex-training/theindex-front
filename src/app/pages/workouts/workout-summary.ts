import { OutputData } from '@editorjs/editorjs';
import { WorkoutSummary } from '../../services/workouts.service';

/**
 * The text of a paragraph's HTML: tags dropped, <br> a new line, entities decoded. For checking
 * that a summary isn't empty and for showing it; the API sanitizes what is stored.
 */
export function summaryLineText(html: string): string {
  const element = document.createElement('div');
  element.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  return (element.textContent ?? '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Editor.js output as a summary: paragraphs only, empty ones left out. */
export function summaryFromEditor(data: OutputData): WorkoutSummary {
  const blocks = data.blocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => {
      const raw = (block.data as { text?: unknown }).text;
      const text = typeof raw === 'string' ? raw : '';
      return {
        ...(block.id ? { id: block.id } : {}),
        type: 'paragraph' as const,
        data: { text },
      };
    })
    .filter((block) => summaryLineText(block.data.text));
  return {
    ...(data.time ? { time: data.time } : {}),
    ...(data.version ? { version: data.version } : {}),
    blocks,
  };
}

/** Whether a summary has any text: what the API requires. */
export function hasSummaryText(summary: WorkoutSummary | null): boolean {
  return !!summary?.blocks.some((block) => summaryLineText(block.data.text));
}
