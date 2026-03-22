/**
 * particles.js — Particle effects system with multiple style modes
 *
 * The active style is read from Unlocks.getEquippedParticleStyle() each time
 * particles are emitted, so equipping a new style takes effect immediately.
 */

'use strict';

class Particle {
  constructor(x, y, color, vx, vy, size, lifetime, style = 'classic') {
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
    this.rotSpeed = (Math.random() - 0.5) * 0.25;
    this.style    = style;
    // Per-style extras
    this.trail    = [];  // for 'stars'
    this.aspect   = style === 'confetti' ? (0.15 + Math.random() * 0.15) : 1; // thin strips
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.lifetime) return false;

    const progress = this.age / this.lifetime;
    this.alpha  = 1 - progress;

    if (this.style === 'stars') {
      this.trail.push({ x: this.x, y: this.y, a: this.alpha * 0.5 });
      if (this.trail.length > 6) this.trail.shift();
    }

    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vy += 280 * dt; // gravity
    this.rotation += this.rotSpeed;
    this.size *= 0.985;
    return true;
  }

  draw(ctx) {
    if (this.alpha <= 0 || this.size <= 0.5) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    switch (this.style) {
      case 'stars':
        this._drawStar(ctx);
        break;
      case 'confetti':
        this._drawConfetti(ctx);
        break;
      case 'sparkles':
        this._drawSparkle(ctx);
        break;
      default:
        this._drawClassic(ctx);
    }

    ctx.restore();
  }

  _drawClassic(ctx) {
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (Math.floor(this.rotation * 4) % 2 === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
    }
  }

  _drawStar(ctx) {
    // Draw trail first
    for (const pt of this.trail) {
      ctx.save();
      ctx.globalAlpha = pt.a * this.alpha;
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Draw 4-point star at current position
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const s = this.size;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r     = i % 2 === 0 ? s : s * 0.4;
      const angle = (i / 8) * Math.PI * 2;
      const px    = Math.cos(angle) * r;
      const py    = Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawConfetti(ctx) {
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    // Thin rectangular strip
    ctx.fillRect(-this.size, -this.size * this.aspect, this.size * 2, this.size * this.aspect * 2);
  }

  _drawSparkle(ctx) {
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = Math.max(1, this.size * 0.4);
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const s = this.size;
    // Cross shape
    ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
    ctx.moveTo(0, -s); ctx.lineTo(0, s);
    ctx.stroke();
    // Diagonal
    const d = s * 0.6;
    ctx.beginPath();
    ctx.moveTo(-d, -d); ctx.lineTo(d, d);
    ctx.moveTo(d, -d);  ctx.lineTo(-d, d);
    ctx.stroke();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  _getStyle() {
    try {
      return Unlocks.getEquippedParticleStyle().id.replace('particles_', '');
    } catch {
      return 'classic';
    }
  }

  /**
   * Emit particles at canvas coordinates (x, y).
   */
  emit(x, y, colors, count = 12, opts = {}) {
    const colorArr = Array.isArray(colors) ? colors : [colors];
    const style    = opts.style || this._getStyle();
    for (let i = 0; i < count; i++) {
      const angle    = Math.random() * Math.PI * 2;
      const speed    = (opts.speed || 150) + Math.random() * (opts.speedSpread || 100);
      const vx       = Math.cos(angle) * speed;
      const vy       = Math.sin(angle) * speed - (opts.upward ? 80 : 0);
      const size     = (opts.size || 5) + Math.random() * (opts.sizeSpread || 4);
      const lifetime = (opts.lifetime || 0.6) + Math.random() * (opts.lifetimeSpread || 0.3);
      const color    = colorArr[Math.floor(Math.random() * colorArr.length)];
      this.particles.push(new Particle(x, y, color, vx, vy, size, lifetime, style));
    }
  }

  emitScore(x, y, count = 8) {
    this.emit(x, y, ['#FDCB6E','#FFA502','#FFD700'], count, {
      speed: 80, speedSpread: 60, size: 3, sizeSpread: 3,
      lifetime: 0.5, lifetimeSpread: 0.2, upward: true,
    });
  }

  emitRainbow(x, y) {
    this.emit(x, y, COLORS, 28, {
      speed: 180, speedSpread: 120, size: 6, sizeSpread: 4,
      lifetime: 0.8, lifetimeSpread: 0.3,
    });
  }

  emitBomb(x, y) {
    this.emit(x, y, ['#ff4757','#ffa502','#2d3436','#fdcb6e'], 36, {
      speed: 250, speedSpread: 180, size: 7, sizeSpread: 6,
      lifetime: 0.9, lifetimeSpread: 0.3,
    });
  }

  emitPowerup(x, y, color) {
    this.emit(x, y, [color, '#FFFFFF'], 20, {
      speed: 200, speedSpread: 100, size: 5, sizeSpread: 4,
      lifetime: 0.7, lifetimeSpread: 0.2, upward: true,
    });
  }

  update(dt) {
    this.particles = this.particles.filter(p => p.update(dt));
  }

  draw(ctx) {
    for (const p of this.particles) p.draw(ctx);
  }

  clear() { this.particles = []; }

  get count() { return this.particles.length; }
}
