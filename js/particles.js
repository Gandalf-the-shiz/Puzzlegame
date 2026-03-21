/**
 * particles.js — Particle effects system
 */

'use strict';

class Particle {
  constructor(x, y, color, vx, vy, size, lifetime) {
    this.x        = x;
    this.y        = y;
    this.color    = color;
    this.vx       = vx;
    this.vy       = vy;
    this.size     = size;
    this.lifetime = lifetime;
    this.age      = 0;
    this.alpha    = 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.2;
    this.shape    = Math.random() < 0.5 ? 'circle' : 'square';
  }

  /** Update particle physics. Returns false when dead. */
  update(dt) {
    this.age += dt;
    if (this.age >= this.lifetime) return false;

    const progress = this.age / this.lifetime;
    this.alpha = 1 - progress;
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += 300 * dt; // gravity
    this.rotation += this.rotSpeed;
    this.size *= 0.99;
    return true;
  }

  draw(ctx) {
    if (this.alpha <= 0 || this.size <= 0.5) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle   = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    }

    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  /**
   * Emit an explosion of particles at canvas coordinates (x, y)
   * @param {number} x
   * @param {number} y
   * @param {string|string[]} colors — one or more colors
   * @param {number} count
   * @param {object} opts — optional overrides
   */
  emit(x, y, colors, count = 12, opts = {}) {
    const colorArr = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < count; i++) {
      const angle    = Math.random() * Math.PI * 2;
      const speed    = (opts.speed || 150) + Math.random() * (opts.speedSpread || 100);
      const vx       = Math.cos(angle) * speed;
      const vy       = Math.sin(angle) * speed - (opts.upward ? 80 : 0);
      const size     = (opts.size || 5) + Math.random() * (opts.sizeSpread || 4);
      const lifetime = (opts.lifetime || 0.6) + Math.random() * (opts.lifetimeSpread || 0.3);
      const color    = colorArr[Math.floor(Math.random() * colorArr.length)];

      this.particles.push(new Particle(x, y, color, vx, vy, size, lifetime));
    }
  }

  /**
   * Emit a "score popup" burst (golden sparkle upward)
   */
  emitScore(x, y, count = 8) {
    this.emit(x, y, ['#FDCB6E', '#FFA502', '#FFD700'], count, {
      speed: 80, speedSpread: 60, size: 3, sizeSpread: 3,
      lifetime: 0.5, lifetimeSpread: 0.2, upward: true,
    });
  }

  /**
   * Emit a rainbow burst (for rainbow block match)
   */
  emitRainbow(x, y) {
    this.emit(x, y, COLORS, 24, {
      speed: 180, speedSpread: 120, size: 6, sizeSpread: 4,
      lifetime: 0.8, lifetimeSpread: 0.3,
    });
  }

  /**
   * Emit bomb explosion (dark + orange)
   */
  emitBomb(x, y) {
    this.emit(x, y, ['#ff4757', '#ffa502', '#2d3436', '#fdcb6e'], 32, {
      speed: 220, speedSpread: 150, size: 7, sizeSpread: 5,
      lifetime: 0.9, lifetimeSpread: 0.3,
    });
  }

  /**
   * Update all particles. Call every frame with delta time in seconds.
   */
  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
  }

  /**
   * Draw all particles to a canvas context.
   */
  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
  }

  get count() { return this.particles.length; }
}
