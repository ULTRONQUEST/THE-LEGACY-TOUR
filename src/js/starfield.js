/**
 * Star Field — procedural star canvas for deep space background.
 * Creates layers of stars with varying sizes and brightness for depth.
 */
export class StarField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.animationId = null;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.resize();
    this.createStars();

    window.addEventListener('resize', () => {
      this.resize();
      this.createStars();
    });
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.scale(dpr, dpr);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  createStars() {
    this.stars = [];
    // Density: ~1 star per 3000px² area
    const area = this.width * this.height;
    const count = Math.floor(area / 3000);

    for (let i = 0; i < count; i++) {
      const layer = Math.random(); // 0=distant, 1=close
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: layer < 0.7 ? 0.4 + Math.random() * 0.3 : 0.6 + Math.random() * 0.8,
        baseOpacity: layer < 0.7 ? 0.15 + Math.random() * 0.3 : 0.4 + Math.random() * 0.5,
        twinkleSpeed: 0.3 + Math.random() * 1.5,
        twinkleOffset: Math.random() * Math.PI * 2,
        // A few stars get a warm or blue tint
        color: this._starColor(layer),
      });
    }
  }

  _starColor(layer) {
    const r = Math.random();
    if (r < 0.03) return 'rgba(212, 165, 74,'; // amber
    if (r < 0.08) return 'rgba(77, 201, 246,';  // cyan
    if (r < 0.12) return 'rgba(200, 210, 255,';  // blue-white
    return 'rgba(232, 230, 225,'; // off-white
  }

  render(time = 0) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (const star of this.stars) {
      let opacity = star.baseOpacity;

      if (!this.prefersReducedMotion) {
        // Gentle twinkle
        const twinkle = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinkleOffset);
        opacity = star.baseOpacity * (0.6 + 0.4 * twinkle);
      }

      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${star.color}${opacity.toFixed(3)})`;
      this.ctx.fill();
    }

    this.animationId = requestAnimationFrame((t) => this.render(t));
  }

  start() {
    if (!this.animationId) {
      this.render();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

