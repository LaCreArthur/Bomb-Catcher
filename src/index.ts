import { Application, Sprite, Texture, AnimatedSprite, Text, TextStyle, Ticker, Assets, Container, Point, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { Sound } from '@pixi/sound';

// Register GSAP PixiPlugin
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI({ Application, Sprite, Texture, AnimatedSprite, Text, TextStyle, Container, Graphics });

// Game Configuration
const config = {
	// Canvas settings
	canvasWidth: 800,
	canvasHeight: 600,
	floorHeight: 50,

	// Game settings
	initialLives: 9,
	initialSpawnRate: 3.8, // Bombs per second at start
	initialSpeed: 2, // Pixels per frame at start
	bombWidth: 80,
	bombHeight: 80,
	bombAngleVariance: 45, // Degrees +/- from vertical
	bombRotationSpeed: 0.01,

	// Difficulty scaling
	spawnRateIncrease: 0.005,
	speedIncrease: 0.01,
	maxSpawnRate: 5,
	maxSpeed: 10,

	// Animation values
	catchScale: 0.2,
	catchDuration: 0.3,
	explodeDuration: 0.5,
	screenShakeIntensity: 5,
	screenShakeDuration: 0.1,

	// Asset paths
	bombIdlePrefix: 'assets/bomb/Bomb_3_Idle_00',
	bombIdleFrames: 6,
	bombExplosionPrefix: 'assets/bomb/Bomb_3_Explosion_00',
	bombExplosionFrames: 10,
	floorTexture: 'assets/floor.png',
	backgroundTexture: 'assets/background.jpg',

	sounds: {
		catch: 'assets/catch.mp3',
		explode: 'assets/explode.mp3',
		gameover: 'assets/gameover.mp3',
	},

	// Leaderboard
	maxLeaderboardEntries: 5,
	leaderboardKey: 'bombCatcherScores',
};

// Game states
enum GameState {
	Loading,
	Ready,
	Playing,
	GameOver,
}

// Asset types
type GameAssets = {
	textures: {
		idle: Texture[];
		explosion: Texture[];
		floor: Texture;
		background: Texture;
	};
	sounds: {
		catch?: Sound;
		explode?: Sound;
		gameover?: Sound;
	};
};

/**
 * Handles loading all game assets
 */
async function loadAssets(): Promise<GameAssets> {
	try {
		// Prepare arrays for loading frames
		const idleFrames = Array.from({ length: config.bombIdleFrames }, (_, i) => `${config.bombIdlePrefix}${i}.png`);
		const explosionFrames = Array.from({ length: config.bombExplosionFrames }, (_, i) => `${config.bombExplosionPrefix}${i}.png`);

		// Load all textures at once
		const textureAssets = await Assets.load<Texture>([...idleFrames, ...explosionFrames, config.floorTexture, config.backgroundTexture]);

		// Organize textures by type
		const textures = {
			idle: idleFrames.map((path) => textureAssets[path]),
			explosion: explosionFrames.map((path) => textureAssets[path]),
			floor: textureAssets[config.floorTexture],
			background: textureAssets[config.backgroundTexture],
		};

		// Load sounds
		const sounds = {
			catch: Sound.from(config.sounds.catch),
			explode: Sound.from(config.sounds.explode),
			gameover: Sound.from(config.sounds.gameover),
		};

		return { textures, sounds };
	} catch (error) {
		console.error('Failed to load assets:', error);
		return {
			textures: { idle: [], explosion: [], floor: Texture.EMPTY, background: Texture.EMPTY },
			sounds: {},
		};
	}
}

/**
 * UI Manager class to handle all UI elements
 */
class UIManager {
	private stage: Container;
	private elements = new Map<string, Text | Container>();

	// Define text styles once to avoid duplication
	static readonly Styles = {
		primary: new TextStyle({
			fontFamily: 'Arial',
			fontSize: 24,
			fontWeight: 'bold',
			fill: '#ffffff',
			stroke: { color: '#000000', width: 4, join: 'round' },
			dropShadow: { color: '#000000', blur: 4, distance: 2, alpha: 0.4 },
		}),

		title: new TextStyle({
			fontFamily: 'Arial',
			fontSize: 48,
			fontWeight: 'bold',
			fill: '#ffff00',
			stroke: { color: '#000000', width: 6, join: 'round' },
			dropShadow: { color: '#000000', blur: 5, distance: 3, alpha: 0.5 },
		}),

		button: new TextStyle({
			fontFamily: 'Arial',
			fontSize: 36,
			fontWeight: 'bold',
			fill: '#ffffff',
			stroke: { color: '#333333', width: 5, join: 'round' },
			dropShadow: { color: '#000000', blur: 3, distance: 2, alpha: 0.5 },
		}),

		leaderboard: new TextStyle({
			fontFamily: 'Courier New',
			fontSize: 20,
			fill: '#ffffff',
			align: 'center',
			lineHeight: 28,
		}),
	};

	constructor(stage: Container) {
		this.stage = stage;
	}

	addText(id: string, content: string, x: number, y: number, style = UIManager.Styles.primary, anchor = new Point(0, 0)): Text {
		this.removeElement(id);

		const text = new Text({ text: content, style });
		text.position.set(x, y);
		text.anchor.copyFrom(anchor);

		this.stage.addChild(text);
		this.elements.set(id, text);
		return text;
	}

	addButton(id: string, label: string, x: number, y: number, onClick: () => void): Text {
		const button = this.addText(id, label, x, y, UIManager.Styles.button, new Point(0.5, 0.5));

		button.eventMode = 'static';
		button.cursor = 'pointer';
		button.on('pointerdown', onClick);

		// Add hover effect
		button.on('pointerover', () => gsap.to(button, { pixi: { scale: 1.1 }, duration: 0.1 }));
		button.on('pointerout', () => gsap.to(button, { pixi: { scale: 1.0 }, duration: 0.1 }));

		return button;
	}

	updateText(id: string, content: string): void {
		const element = this.elements.get(id);
		if (element instanceof Text) {
			element.text = content;
		}
	}

	getElement(id: string): Container | undefined {
		return this.elements.get(id);
	}

	animateElement(id: string, animation: gsap.TweenVars): void {
		const element = this.elements.get(id);
		if (element) {
			gsap.to(element, animation);
		}
	}

	removeElement(id: string): void {
		const element = this.elements.get(id);
		if (element) {
			this.stage.removeChild(element);
			element.destroy();
			this.elements.delete(id);
		}
	}

	clearAll(): void {
		this.stopAllAnimations();
		this.stage.position.set(0, 0);
		this.elements.forEach((element) => {
			this.stage.removeChild(element);
			element.destroy();
		});
		this.elements.clear();
	}

	stopAllAnimations(): void {
		this.elements.forEach((element) => {
			gsap.killTweensOf(element);
		});
		gsap.killTweensOf(this.stage);
	}

	// UI Screen methods

	showStartScreen(onStartClick: () => void): void {
		this.clearAll();
		this.addText('title', 'Bomb Catcher', config.canvasWidth / 2, config.canvasHeight / 3, UIManager.Styles.title, new Point(0.5, 0.5));
		this.addButton('startButton', 'Start Game', config.canvasWidth / 2, config.canvasHeight / 2 + 50, onStartClick);
	}

	showGameUI(score: number, lives: number): void {
		this.clearAll();
		this.addText('scoreLabel', `Score: ${score}`, 70, 30, UIManager.Styles.primary, new Point(0.5, 0.5));
		this.addText('livesLabel', `Lives: ${lives}`, 70, 65, UIManager.Styles.primary, new Point(0.5, 0.5));
	}

	showGameOverScreen(finalScore: number, leaderboard: string, onReplayClick: () => void): void {
		this.clearAll();
		this.addText('gameOverTitle', 'Game Over!', config.canvasWidth / 2, config.canvasHeight / 2 - 150, UIManager.Styles.title, new Point(0.5, 0.5));
		this.addText(
			'finalScoreLabel',
			`Final Score: ${finalScore}`,
			config.canvasWidth / 2,
			config.canvasHeight / 2 - 80,
			UIManager.Styles.primary,
			new Point(0.5, 0.5),
		);

		this.addButton('replayButton', 'Replay', config.canvasWidth / 2, config.canvasHeight / 2, onReplayClick);

		this.addText(
			'leaderboard',
			`Top Scores:\n${leaderboard}`,
			config.canvasWidth / 2,
			config.canvasHeight / 2 + 125,
			UIManager.Styles.leaderboard,
			new Point(0.5, 0.5),
		);
	}

	shakeScreen(): void {
		if (!this.stage) return;

		gsap.to(this.stage, {
			x: `random(-${config.screenShakeIntensity}, ${config.screenShakeIntensity})`,
			y: `random(-${config.screenShakeIntensity}, ${config.screenShakeIntensity})`,
			duration: config.screenShakeDuration,
			repeat: 3,
			yoyo: true,
			onComplete: () => {
				this.stage.position.set(0, 0);
			},
		});
	}
}

/**
 * Bomb class - handles bomb behavior and animation
 */
class Bomb extends AnimatedSprite {
	private vx = 0;
	private vy = 0;
	private explosionTextures: Texture[];
	private floorY: number;
	public hasExploded = false;

	// Callbacks for bomb events
	onCatch: () => void;
	onHitFloor: (bomb: Bomb) => void;
	onExplosionComplete: (bomb: Bomb) => void;

	constructor(
		textures: Texture[],
		explosionTextures: Texture[],
		floorY: number,
		onCatch: () => void,
		onHitFloor: (bomb: Bomb) => void,
		onExplosionComplete: (bomb: Bomb) => void,
	) {
		super(textures);
		this.explosionTextures = explosionTextures;

		this.floorY = floorY;
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
		if (this.x < this.width / 2) {
			this.x = this.width / 2;
			this.vx = -this.vx;
		} else if (this.x > config.canvasWidth - this.width / 2) {
			this.x = config.canvasWidth - this.width / 2;
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
		}
	};

	destroy(): void {
		this.removeAllListeners();
		super.destroy();
	}
}

/**
 * Main Game class - handles game loop and mechanics
 */
class Game {
	private app: Application;
	private assets: GameAssets;
	private ui: UIManager;

	// Game state
	private gameState = GameState.Loading;
	private score = 0;
	private lives = config.initialLives;
	private spawnRate = config.initialSpawnRate;
	private speed = config.initialSpeed;
	private spawnTimer = 0;

	// Game elements
	private bombs: Bomb[] = [];
	private floor: Sprite;
	private floorY: number;

	constructor(app: Application, assets: GameAssets) {
		this.app = app;
		this.assets = assets;
		this.ui = new UIManager(app.stage);

		// Create background
		const background = new Sprite(this.assets.textures.background);
		background.width = config.canvasWidth + config.screenShakeIntensity * 2;
		background.height = config.canvasHeight + config.screenShakeIntensity * 2;
		background.x = -config.screenShakeIntensity;
		background.y = -config.screenShakeIntensity;
		app.stage.addChild(background);

		// Create floor
		this.floor = new Sprite(assets.textures.floor);
		this.floor.width = config.canvasWidth + config.screenShakeIntensity * 2; // Extend slightly beyond canvas width for the screen shake effect
		this.floor.height = config.floorHeight;
		this.floor.x = -config.screenShakeIntensity; // Center the floor
		this.floor.y = config.canvasHeight - config.floorHeight + config.screenShakeIntensity;
		this.floorY = this.floor.y; // Store floor Y position for collision detection
		app.stage.addChild(this.floor);

		// Start with the intro screen
		this.showStartScreen();
	}

	// Game State Methods
	private showStartScreen(): void {
		this.gameState = GameState.Ready;
		this.clearBombs();
		this.ui.showStartScreen(() => this.startGame());
	}

	private startGame(): void {
		this.gameState = GameState.Playing;

		// Reset game state
		this.score = 0;
		this.lives = config.initialLives;
		this.spawnRate = config.initialSpawnRate;
		this.speed = config.initialSpeed;
		this.spawnTimer = 1 / this.spawnRate;

		this.ui.showGameUI(this.score, this.lives);
		this.app.ticker.add(this.update, this);
	}

	private endGame(): void {
		if (this.gameState === GameState.GameOver) return;

		this.gameState = GameState.GameOver;
		this.app.ticker.remove(this.update, this);

		this.bombs.forEach((bomb) => {
			bomb.explode();
		});

		this.assets.sounds.gameover?.play();
		this.saveScore();
		this.ui.showGameOverScreen(this.score, this.getLeaderboard(), () => this.showStartScreen());
	}

	private update(ticker: Ticker): void {
		if (this.gameState !== GameState.Playing) return;

		const delta = ticker.deltaTime;
		const deltaSeconds = delta / 60; // 60fps

		// Handle bomb spawning
		this.spawnTimer -= deltaSeconds;
		if (this.spawnTimer <= 0) {
			this.spawnBomb();
			this.spawnTimer += 1 / this.spawnRate;
		}
	}

	// Bomb Management Methods
	private spawnBomb(): void {
		// Calculate position and angle
		const x = Math.random() * (config.canvasWidth - config.bombWidth) + config.bombWidth / 2;
		const y = -config.bombHeight / 2;
		const angle = Math.random() * config.bombAngleVariance * 2 - config.bombAngleVariance;

		// Create new bomb
		const bomb = new Bomb(
			this.assets.textures.idle,
			this.assets.textures.explosion,
			this.floorY,
			() => this.catchBomb(bomb),
			(b) => this.bombHitFloor(b),
			(b) => this.cleanupBomb(b),
		);

		bomb.initialize(x, y, this.speed, angle);
		this.bombs.push(bomb);
		this.app.stage.addChild(bomb);
	}

	private catchBomb(bomb: Bomb): void {
		if (this.gameState !== GameState.Playing) return;

		console.log('Bomb caught!');

		// Play sound
		this.assets.sounds.catch?.play();

		// Increase score
		this.score++;
		this.ui.updateText('scoreLabel', `Score: ${this.score}`);
		this.ui.animateElement('scoreLabel', {
			pixi: { scale: 1.2 },
			duration: 0.1,
			yoyo: true,
			repeat: 1,
		});

		// Increase difficulty
		this.increaseDifficulty();

		// Animate catch and remove
		gsap.to(bomb, {
			pixi: { scale: config.catchScale, alpha: 0 },
			duration: config.catchDuration,
			onComplete: () => this.cleanupBomb(bomb),
		});
	}

	private bombHitFloor(bomb: Bomb): void {
		if (this.gameState !== GameState.Playing || bomb.hasExploded) return;

		console.log('bombHitFloor');

		// Play sound and start explosion
		this.assets.sounds.explode?.play();
		bomb.explode();

		// Shake screen
		this.ui.shakeScreen();

		// Decrease lives
		this.lives--;
		this.ui.updateText('livesLabel', `Lives: ${this.lives}`);
		this.ui.animateElement('livesLabel', {
			pixi: { scale: 0.8 },
			duration: 0.1,
			yoyo: true,
			repeat: 1,
		});

		// Check for game over
		if (this.lives <= 0) {
			this.endGame();
		}
	}

	private cleanupBomb(bomb: Bomb): void {
		// Remove from bombs array
		const index = this.bombs.indexOf(bomb);
		if (index > -1) {
			this.bombs.splice(index, 1);
		}

		// Remove from stage and destroy properly
		this.app.stage.removeChild(bomb);
		bomb.destroy();
	}

	private clearBombs(): void {
		// Properly destroy all bombs
		for (const bomb of this.bombs) {
			this.app.stage.removeChild(bomb);
			bomb.destroy();
		}
		this.bombs = [];
	}

	// Helper Methods
	private increaseDifficulty(): void {
		this.speed = Math.min(config.maxSpeed, this.speed + config.speedIncrease);
		this.spawnRate = Math.min(config.maxSpawnRate, this.spawnRate + config.spawnRateIncrease);
	}

	private saveScore(): void {
		try {
			const scores = this.loadScores();
			scores.push(this.score);
			scores.sort((a, b) => b - a);
			localStorage.setItem(config.leaderboardKey, JSON.stringify(scores.slice(0, config.maxLeaderboardEntries)));
		} catch (error) {
			console.error('Failed to save score:', error);
		}
	}

	private loadScores(): number[] {
		try {
			const data = localStorage.getItem(config.leaderboardKey);
			return data ? JSON.parse(data) : [];
		} catch {
			return [];
		}
	}

	private getLeaderboard(): string {
		const scores = this.loadScores();
		if (scores.length === 0) return 'No scores yet!';
		return scores.map((score, i) => `${(i + 1).toString().padStart(1)}. ${score.toString().padStart(2)}`).join('\n');
	}
}

/**
 * Game initialization
 */
async function main() {
	// Get container element
	const container = document.getElementById('game');
	if (!container) {
		console.error("Element with ID 'game' not found");
		return;
	}

	// Create Pixi application
	const app = new Application();
	await app.init({
		width: config.canvasWidth,
		height: config.canvasHeight,
		backgroundColor: 0x1099bb,
		antialias: true,
	});

	// Add canvas to DOM
	container.appendChild(app.canvas);
	container.style.display = 'flex';
	container.style.justifyContent = 'center';
	container.style.alignItems = 'center';

	// Load assets
	const assets = await loadAssets();

	// Start game
	new Game(app, assets);
}

document.addEventListener('DOMContentLoaded', main);
