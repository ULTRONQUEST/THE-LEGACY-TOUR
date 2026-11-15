/**
 * Parallax — subtle mouse-based parallax for the Earth and content.
 * Respects prefers-reduced-motion.
 */
export class Parallax {
  constructor() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.prefersReducedMotion) return;

    this.mouseX = 0.5;
    this.mouseY = 0.5;
    this.currentX = 0.5;
    this.currentY = 0.5;

    this.earth = document.querySelector('.landing__earth-image');
    this.glow = document.querySelector('.landing__earth-glow');

    this._onMouseMove = this._onMouseMove.bind(this);
    this._update = this._update.bind(this);

    document.addEventListener('mousemove', this._onMouseMove, { passive: true });
    this._update();
  }

  _onMouseMove(e) {
    this.mouseX = e.clientX / window.innerWidth;
    this.mouseY = e.clientY / window.innerHeight;
  }

  _update() {
    // Smooth interpolation
    this.currentX += (this.mouseX - this.currentX) * 0.04;
    this.currentY += (this.mouseY - this.currentY) * 0.04;

    const offsetX = (this.currentX - 0.5) * 2;
    const offsetY = (this.currentY - 0.5) * 2;

    if (this.earth) {
      const earthX = -50 + offsetX * -1.5;
      const earthY = offsetY * -2;
      this.earth.style.transform = `translateX(${earthX}%) translateY(${earthY}px)`;
    }

    if (this.glow) {
      const glowX = -50 + offsetX * -1;
      this.glow.style.transform = `translateX(${glowX}%)`;
    }

    requestAnimationFrame(this._update);
  }

  destroy() {
    document.removeEventListener('mousemove', this._onMouseMove);
  }
}

