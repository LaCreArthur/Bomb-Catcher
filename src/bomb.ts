import { AnimatedSprite, Texture, Ticker } from 'pixi.js';
import { config } from './config';

/**
 * Bomb class - handles bomb behavior and animation
 */
export class Bomb extends AnimatedSprite {
	private vx = 0;
	private vy = 0;
	private explosionTextures: Texture[];
	private floorY: number = config.canvasHeight - config.floorHeight;
	public hasExploded = false;

	// Callbacks for bomb events
	onCatch: () => void;
	onHitFloor: (bomb: Bomb) => void;
	onExplosionComplete: (bomb: Bomb) => void;

	constructor(
		textures: Texture[],
		explosionTextures: Texture[],
		onCatch: () => void,
		onHitFloor: (bomb: Bomb) => void,
		onExplosionComplete: (bomb: Bomb) => void,
	) {
		super(textures);
		this.explosionTextures = explosionTextures;

		this.onCatch = onCatch;
		this.onHitFloor = onHitFloor;
		this.onExplosionComplete = onExplosionComplete;

		// Setup properties
		this.anchor.set(0.5);
		this.width = config.bombWidth;
		this.height = config.bombHeight;

		// Setup interaction
		this.eventMode = 'static';
		this.cursor = 'pointer';
		this.on('pointerdown', this.handleClick);

		// Handle animation completion
		this.onComplete = () => {
			if (this.hasExploded) {
				this.onExplosionComplete(this);
			}
		};
	}

	initialize(x: number, y: number, speed: number, angleDegrees: number): void {
		// Position and rotation
		this.position.set(x, y);
		this.rotation = Math.random() * Math.PI * 2;

		// Calculate velocity components
		const angleRad = (angleDegrees * Math.PI) / 180;
		this.vx = speed * Math.sin(angleRad);
		this.vy = speed * Math.cos(angleRad);

		// Reset state
		this.hasExploded = false;
		this.visible = true;
		this.eventMode = 'static';
		this.animationSpeed = 1;
		this.loop = true;
		this.play();
	}

	update(delta: Ticker): void {
		super.update(delta);
		if (this.hasExploded) return;

		// Update position
		const deltaTime = delta.deltaTime;
		this.x += this.vx * deltaTime;
		this.y += this.vy * deltaTime;
		this.rotation += config.bombRotationSpeed * deltaTime;

		// Wall bounce
		if (this.x < 0) {
			this.x = 0;
			this.vx = -this.vx;
		} else if (this.x > config.canvasWidth) {
			this.x = config.canvasWidth;
			this.vx = -this.vx;
		}
		// Floor collision
		if (this.y >= this.floorY) {
			this.onHitFloor(this);
		}
	}

	explode(): void {
		if (this.hasExploded) return;
		this.hasExploded = true;
		this.textures = this.explosionTextures;
		this.loop = false;
		this.animationSpeed = 0.5;
		this.play();
	}

	private handleClick = (): void => {
		if (!this.hasExploded) {
			this.onCatch();
			this.eventMode = 'none';
		}
	};

	destroy(): void {
		this.removeAllListeners();
		super.destroy();
	}
}
