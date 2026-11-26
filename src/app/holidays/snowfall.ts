/**
 * The falling snow and the little bursts of it, drawn on one full-window canvas that ignores the
 * pointer. Few flakes (a few dozen, fewer on phones), stopped while the tab is hidden and when
 * there is nothing to draw. Colors come from the theme's `--snow-fill` / `--snow-edge` tokens, and
 * the confetti's from `--holiday-red` / `--holiday-green` / `--holiday-gold`.
 */

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  /** A piece of confetti: its color and how it turns; a snowflake has none. */
  color?: string;
  turn?: number;
  spin?: number;
}

const CONFETTI_TOKENS = [
  '--holiday-red',
  '--holiday-green',
  '--holiday-gold',
  '--snow-fill',
];

/** About one flake per this many square pixels, at full intensity. */
const AREA_PER_FLAKE = 12_000;
const MAX_FLAKES = 90;

export class Snowfall {
  private readonly context: CanvasRenderingContext2D | null;
  private flakes: Flake[] = [];
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private intensity = 0;
  private frame = 0;
  private fill = '';
  private edge = '';
  private confettiColors: string[] = [];

  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => this.kick();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: Window,
  ) {
    this.context = canvas.getContext?.('2d') ?? null;
    view.addEventListener('resize', this.onResize);
    view.document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  /** 0 stops the snowfall; 1 is a full snowfall. */
  setIntensity(intensity: number): void {
    this.intensity = intensity;
    this.readColors();
    const target = Math.round(
      Math.min(MAX_FLAKES, (this.width * this.height) / AREA_PER_FLAKE) *
        intensity,
    );
    while (this.flakes.length < target) {
      this.flakes.push(this.flake(true));
    }
    this.flakes.length = target;
    this.kick();
  }

  /** Confetti thrown up from (x, y): a gift opened, a celebration over Christmas. */
  confetti(x: number, y: number, count = 80): void {
    this.readColors();
    if (!this.confettiColors.length) {
      return;
    }
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 4 + Math.random() * 5;
      const max = 90 + Math.random() * 50;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 2.5,
        life: max,
        max,
        color: this.confettiColors[i % this.confettiColors.length],
        turn: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
      });
    }
    this.kick();
  }

  /** A puff of snow rising from (x, y), e.g. above the celebration's line. */
  burst(x: number, y: number, count = 40): void {
    this.readColors();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.4;
      const max = 70 + Math.random() * 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.6,
        r: 1.4 + Math.random() * 2.2,
        life: max,
        max,
      });
    }
    this.kick();
  }

  destroy(): void {
    this.view.cancelAnimationFrame(this.frame);
    this.view.removeEventListener('resize', this.onResize);
    this.view.document.removeEventListener(
      'visibilitychange',
      this.onVisibility,
    );
  }

  private resize(): void {
    const ratio = Math.min(2, this.view.devicePixelRatio || 1);
    this.width = this.view.innerWidth;
    this.height = this.view.innerHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (this.intensity) {
      this.setIntensity(this.intensity);
    }
  }

  private readColors(): void {
    const style = this.view.getComputedStyle(
      this.view.document.documentElement,
    );
    this.fill = style.getPropertyValue('--snow-fill').trim() || this.fill;
    this.edge = style.getPropertyValue('--snow-edge').trim() || this.edge;
    this.confettiColors = CONFETTI_TOKENS.map((token) =>
      style.getPropertyValue(token).trim(),
    ).filter(Boolean);
  }

  private flake(anywhere: boolean): Flake {
    const depth = Math.random();
    return {
      x: Math.random() * this.width,
      y: anywhere ? Math.random() * this.height : -6,
      r: 0.8 + depth * 2.2,
      vy: 0.25 + depth * 0.7,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.55 + depth * 0.4,
    };
  }

  private kick(): void {
    if (!this.frame && this.context && !this.view.document.hidden) {
      this.frame = this.view.requestAnimationFrame(() => this.tick());
    }
  }

  private tick(): void {
    this.frame = 0;
    const context = this.context;
    if (!context || this.view.document.hidden) {
      return;
    }
    context.clearRect(0, 0, this.width, this.height);
    for (const flake of this.flakes) {
      flake.phase += 0.012;
      flake.y += flake.vy;
      flake.x += Math.sin(flake.phase) * 0.35;
      if (flake.y > this.height + 6) {
        Object.assign(flake, this.flake(false));
      }
      this.dot(context, flake.x, flake.y, flake.r, flake.alpha);
    }
    this.particles = this.particles.filter((particle) => --particle.life > 0);
    for (const particle of this.particles) {
      const fade = Math.min(1, particle.life / (particle.max * 0.4));
      if (particle.color) {
        particle.vx *= 0.97;
        particle.vy = particle.vy * 0.97 + 0.16;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.turn = (particle.turn ?? 0) + (particle.spin ?? 0);
        this.piece(context, particle, fade);
      } else {
        particle.vx *= 0.965;
        particle.vy = particle.vy * 0.965 + 0.03;
        particle.x += particle.vx;
        particle.y += particle.vy;
        this.dot(context, particle.x, particle.y, particle.r, fade);
      }
    }
    if (this.flakes.length || this.particles.length) {
      this.kick();
    }
  }

  /** A flake: the fill with a faint edge, so it shows on the light theme's chalk background too. */
  private dot(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    alpha: number,
  ): void {
    if (!this.fill) {
      return;
    }
    context.globalAlpha = alpha * 0.35;
    context.fillStyle = this.edge;
    context.beginPath();
    context.arc(x, y, r + 0.9, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = alpha;
    context.fillStyle = this.fill;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  /** A piece of confetti: a small turning strip. */
  private piece(
    context: CanvasRenderingContext2D,
    particle: Particle,
    alpha: number,
  ): void {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.color!;
    context.translate(particle.x, particle.y);
    context.rotate(particle.turn ?? 0);
    context.fillRect(
      -particle.r,
      -particle.r / 2.4,
      particle.r * 2,
      particle.r / 1.2,
    );
    context.restore();
  }
}
