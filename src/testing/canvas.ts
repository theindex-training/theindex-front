/**
 * A 2D canvas context for specs (jsdom has none): drawing calls do nothing, except that the text
 * drawn is recorded with its font and place, and text is measured as 0.55 em a character.
 * Plain TypeScript, like the other helpers here.
 */
export interface DrawnText {
  text: string;
  font: string;
  x: number;
  y: number;
}

export function recordingContext(): {
  context: CanvasRenderingContext2D;
  drawn: DrawnText[];
} {
  const drawn: DrawnText[] = [];
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif' };
  const fontSize = () =>
    Number(/(\d+)px/.exec(String(state['font']))?.[1] ?? 10);
  const methods: Record<string, unknown> = {
    fillText: (text: string, x: number, y: number) =>
      drawn.push({ text, font: String(state['font']), x, y }),
    measureText: (text: string) => ({ width: text.length * fontSize() * 0.55 }),
  };
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: (_target, name) =>
      name in methods
        ? methods[name as string]
        : name in state
          ? state[name]
          : () => undefined,
    set: (_target, name, value) => {
      state[name] = value;
      return true;
    },
  });
  return { context, drawn };
}
