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
  /** New Year's rockets on their way up; each bursts into sparks at its top. */
  private rockets: Particle[] = [];
  private sparks: Particle[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
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

  /** A firework bursting at (x, y): sparks flying out and falling, in the confetti's colors. */
  fireworks(x: number, y: number, count = 70): void {
    this.readColors();
    if (!this.confettiColors.length) {
      return;
    }
    const color = (index: number) =>
      this.confettiColors[index % this.confettiColors.length];
    const tint = Math.floor(Math.random() * this.confettiColors.length);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.4 + Math.random() * 3;
      const max = 60 + Math.random() * 40;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2,
        life: max,
        max,
        // Mostly one color per burst, with a few sparks of the others.
        color: color(i % 5 === 0 ? i : tint),
      });
    }
    this.kick();
  }

  /** A rocket from the bottom of the window at x, bursting `top` pixels from the top. */
  rocket(x: number, top: number): void {
    const rise = Math.max(80, this.height - top);
    const gravity = 0.06;
    const vy = -Math.sqrt(2 * gravity * rise);
    const life = Math.round(-vy / gravity);
    this.rockets.push({ x, y: this.height, vx: 0, vy, r: 2, life, max: life });
    this.kick();
  }

  /** A short fireworks show: `count` rockets across the window, one every ~0.6 s. */
  show(count = 7): void {
    for (let i = 0; i < count; i++) {
      this.timers.push(
        setTimeout(
          () =>
            this.rocket(
              this.width * (0.15 + Math.random() * 0.7),
              this.height * (0.15 + Math.random() * 0.3),
            ),
          i * 600 + Math.random() * 300,
        ),
      );
    }
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
    this.timers.forEach((timer) => clearTimeout(timer));
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
    this.drawFireworks(context);
    if (
      this.flakes.length ||
      this.particles.length ||
      this.rockets.length ||
      this.sparks.length
    ) {
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

  /** Rockets rise with a short trail; at their top they burst; sparks fall and fade. */
  private drawFireworks(context: CanvasRenderingContext2D): void {
    const burst: Particle[] = [];
    this.rockets = this.rockets.filter((rocket) => {
      if (--rocket.life <= 0) {
        burst.push(rocket);
        return false;
      }
      return true;
    });
    burst.forEach((rocket) => this.fireworks(rocket.x, rocket.y));
    context.lineCap = 'round';
    for (const rocket of this.rockets) {
      rocket.vy += 0.06;
      rocket.y += rocket.vy;
      this.trail(context, rocket, this.fill, 1);
    }
    this.sparks = this.sparks.filter((spark) => --spark.life > 0);
    for (const spark of this.sparks) {
      spark.vx *= 0.975;
      spark.vy = spark.vy * 0.975 + 0.045;
      spark.x += spark.vx;
      spark.y += spark.vy;
      const fade = Math.min(1, spark.life / (spark.max * 0.4));
      this.trail(context, spark, spark.color ?? this.fill, fade);
    }
  }

  private trail(
    context: CanvasRenderingContext2D,
    particle: Particle,
    color: string,
    alpha: number,
  ): void {
    if (!color) {
      return;
    }
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = particle.r;
    context.beginPath();
    context.moveTo(particle.x - particle.vx * 2, particle.y - particle.vy * 2);
    context.lineTo(particle.x, particle.y);
    context.stroke();
    context.globalAlpha = 1;
  }
}
