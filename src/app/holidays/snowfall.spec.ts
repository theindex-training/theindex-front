import { Snowfall } from './snowfall';

/** A 2D context whose drawing calls do nothing: the spec watches the frames asked for. */
function fakeContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return new Proxy({} as CanvasRenderingContext2D, {
    get: (target, name) =>
      name in target ? target[name as keyof typeof target] : noop,
    set: (target, name, value) => {
      (target as unknown as Record<string | symbol, unknown>)[name] = value;
      return true;
    },
  });
}

describe('Snowfall', () => {
  let frames: FrameRequestCallback[];
  let hidden: boolean;

  beforeEach(() => {
    frames = [];
    hidden = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      fakeContext(),
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      frames.push(callback),
    );
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  });

  afterEach(() => vi.restoreAllMocks());

  /** Runs the frames asked for so far; answers how many new ones they asked for. */
  function runFrames(): number {
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(0));
    return frames.length;
  }

  it('flies a rocket while the tab is shown', () => {
    const snowfall = new Snowfall(document.createElement('canvas'), window);
    snowfall.rocket(100, 50);
    expect(frames).toHaveLength(1);
    // The rocket is still rising after its first frame, so it asks for another.
    expect(runFrames()).toBe(1);
    snowfall.destroy();
  });

  it('queues no rocket while the tab is hidden, so none bursts when it is shown again', () => {
    const snowfall = new Snowfall(document.createElement('canvas'), window);
    hidden = true;
    snowfall.rocket(100, 50);
    expect(frames).toHaveLength(0);

    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    // One frame to see whether anything moves: nothing does, so it asks for no more.
    expect(frames).toHaveLength(1);
    expect(runFrames()).toBe(0);
    snowfall.destroy();
  });
});
