import { gsap } from 'gsap';
import { Container, Graphics, Ticker } from 'pixi.js';

class Particle extends Graphics {
	private vx: number;
	private vy: number;
	private lifetime: number;
	public isDestroyed = false;

	constructor(x: number, y: number, color: number, size: number, speed: number, angle: number, lifetime: number) {
		super();

		this.position.set(x, y);

		this.fill(color);
		this.circle(0, 0, size);
		this.fill();

		// Set velocity based on angle and speed
		const radians = (angle * Math.PI) / 180;
		this.vx = Math.cos(radians) * speed;
		this.vy = Math.sin(radians) * speed;

		this.lifetime = lifetime;
		this.animate();
	}

	private animate(): void {
		gsap.to(this, {
			pixi: {
				alpha: 0,
				scale: 0.1,
			},
			duration: this.lifetime,
			ease: 'power2.out',
			onComplete: () => {
				this.markDestroyed();
				if (this.parent) {
					this.parent.removeChild(this);
				}
				this.destroy({ children: true });
			},
		});
	}

	update(delta: Ticker): void {
		if (this.isDestroyed) return;

		this.x += this.vx * delta.deltaTime;
		this.y += this.vy * delta.deltaTime;
	}

	markDestroyed(): void {
		this.isDestroyed = true;
	}
}

export class ParticleEmitter {
	private container: Container;
	private particles: Particle[] = [];
	private isDestroyed = false;

	constructor(container: Container) {
		this.container = container;
		Ticker.shared.add(this.update, this);
	}

	emit(
		x: number,
		y: number,
		count: number,
		options: {
			color?: number;
			size?: number;
			minSpeed?: number;
			maxSpeed?: number;
			lifetime?: number;
		} = {},
	): void {
		if (this.isDestroyed) return;

		const { color = 0xffd700, size = 4, minSpeed = 1, maxSpeed = 5, lifetime = 0.8 } = options;

		for (let i = 0; i < count; i++) {
			// Random angle in all directions
			const angle = Math.random() * 360;
			// Random speed between min and max
			const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);

			const particle = new Particle(
				x,
				y,
				color,
				size * (0.5 + Math.random() * 0.5), // Slightly randomize size
				speed,
				angle,
				lifetime * (0.8 + Math.random() * 0.4), // Slightly randomize lifetime
			);

			this.container.addChild(particle);
			this.particles.push(particle);
		}
	}

	update = (delta: Ticker): void => {
		if (this.isDestroyed) return;

		// Update all particles
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const particle = this.particles[i];

			// Skip or remove destroyed particles
			if (particle.destroyed || !particle.parent) {
				this.particles.splice(i, 1);
				continue;
			}

			particle.update(delta);
		}
	};

	destroy(): void {
		this.isDestroyed = true;
		Ticker.shared.remove(this.update, this);

		this.particles.forEach((p) => {
			if (p.parent) {
				p.parent.removeChild(p);
			}
			p.markDestroyed();
			p.destroy({ children: true });
		});
		this.particles = [];
	}
}
