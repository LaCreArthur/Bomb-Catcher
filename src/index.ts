import { Application, Sprite, Texture, AnimatedSprite, Text, TextStyle, Ticker, Assets, Container, Point, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { Sound } from '@pixi/sound';

// --- Configuration ---
const config = {
	canvas: { width: 800, height: 600, floorHeight: 50 },
	game: {
		initialLives: 9,
		initialSpawnRate: 0.8,
		initialSpeed: 1.5,
		bombSize: { width: 80, height: 80 },
		bombAngleVariance: 45,
		bombRotationSpeed: 0.01,
	},
	difficulty: {
		spawnRateIncrease: 0.005,
		speedIncrease: 0.01,
		maxSpawnRate: 5,
		maxSpeed: 10,
	},
	animation: {
		bombCatchScale: 0.2,
		bombCatchDuration: 0.3,
		screenShakeIntensity: 5,
		screenShakeDuration: 0.1,
	},
	leaderboard: {
		maxEntries: 5,
		storageKey: 'bombCatcherScores_simplified',
	},
	assets: {
		bombIdlePrefix: 'assets/bomb/Bomb_3_Idle_00',
		bombExplosionPrefix: 'assets/bomb/Bomb_3_Explosion_00',
		floor: 'assets/floor.png',
		sounds: {
			catch: 'assets/catch.mp3',
			explode: 'assets/explode.mp3',
			gameover: 'assets/gameover.mp3',
		},
		bombIdleFrames: 6,
		bombExplosionFrames: 10,
	},
};

// --- Types ---
type GameTextures = {
	idle: Texture[];
	explosion: Texture[];
	floor: Texture;
};

type GameSounds = {
	catch?: Sound;
	explode?: Sound;
	gameover?: Sound;
};

type LoadedAssets = {
	textures: GameTextures;
	sounds: GameSounds;
};

enum GameState {
	Loading,
	Ready, // Waiting to start
	Playing,
	GameOver,
}

// --- Asset Loader ---
class AssetLoader {
	static async load(): Promise<LoadedAssets> {
		try {
			console.log('Loading assets...');
			// Load textures in parallel
			const texturePromises = [
				...Array.from({ length: config.assets.bombIdleFrames }, (_, i) => Assets.load<Texture>(`${config.assets.bombIdlePrefix}${i}.png`)),
				...Array.from({ length: config.assets.bombExplosionFrames }, (_, i) => Assets.load<Texture>(`${config.assets.bombExplosionPrefix}${i}.png`)),
				Assets.load<Texture>(config.assets.floor),
			];
			const loadedTextures = await Promise.all(texturePromises);

			const textures: GameTextures = {
				idle: loadedTextures.slice(0, config.assets.bombIdleFrames),
				explosion: loadedTextures.slice(config.assets.bombIdleFrames, config.assets.bombIdleFrames + config.assets.bombExplosionFrames),
				floor: loadedTextures[config.assets.bombIdleFrames + config.assets.bombExplosionFrames],
			};

			const sounds: GameSounds = {
				catch: Sound.from(config.assets.sounds.catch),
				explode: Sound.from(config.assets.sounds.explode),
				gameover: Sound.from(config.assets.sounds.gameover),
			};

			console.log('Assets loaded successfully.');
			return { textures, sounds };
		} catch (error) {
			console.error('Asset loading failed:', error);
			// Provide fallback empty assets to prevent crashes
			return {
				textures: { idle: [], explosion: [], floor: Texture.EMPTY },
				sounds: {},
			};
		}
	}
}

class UIManager {
	private stage: Container;
	private texts: Map<string, Text> = new Map();

	constructor(stage: Container) {
		this.stage = stage;
	}

	createText(id: string, content: string, x: number, y: number, style?: Partial<TextStyle>) {
		const text = new Text({
			text: content,
			style: { fill: '#ffffff', ...style },
		});
		text.x = x;
		text.y = y;
		this.texts.set(id, text);
		this.stage.addChild(text);
		return text;
	}

	createButton(content: string, x: number, y: number, onClick: () => void) {
		const button = this.createText(content, content, x, y, { fontSize: 36 });
		button.anchor.set(0.5);
		button.interactive = true;
		button.cursor = 'pointer';
		button.on('pointerdown', () => {
			this.stage.removeChild(button);
			onClick();
		});
		return button;
	}

	updateText(id: string, content: string) {
		const text = this.texts.get(id);
		if (text) text.text = content;
	}

	clear() {
		this.stage.removeChildren();
		this.texts.clear();
	}
}

class Game {
	private app: Application;
	private assets: LoadedAssets;
	private bombs: Bomb[] = [];
	private lives: number = config.game.initialLives;
	private score: number = 0;
	private spawnRate: number = config.game.initialSpawnRate;
	private speed: number = config.game.initialSpeed;
	private isPlaying: boolean = false;
	private ui: UIManager;

	constructor(app: Application, assets: LoadedAssets) {
		this.app = app;
		this.assets = assets;
		this.ui = new UIManager(app.stage);
		this.setupUI();
		this.setupFloor();
		this.showStartScreen();
	}

	private setupUI() {
		this.ui.createText('score', `Score: ${this.score}`, 10, 10);
		this.ui.createText('lives', `Lives: ${this.lives}`, 10, 40);
		this.ui.createText('spawnRate', `Spawn Rate: ${this.spawnRate.toFixed(2)}`, 10, 70);
		this.ui.createText('speed', `Speed: ${this.speed.toFixed(2)}`, 10, 100);
	}

	private async setupFloor() {
		const floor = new Sprite(this.assets.textures.floor);
		floor.width = config.canvas.width;
		floor.height = config.canvas.floorHeight;
		floor.y = config.canvas.height - config.canvas.floorHeight;
		this.app.stage.addChild(floor);
	}

	private showStartScreen() {
		this.ui.createButton('Start', config.canvas.width / 2, config.canvas.height / 2, () => this.startGame());
	}

	private startGame() {
		this.resetState();
		this.app.ticker.add((delta) => this.update(delta));
		this.isPlaying = true;
	}

	private update(ticker: Ticker) {
		if (!this.isPlaying) return;
		this.bombs.forEach((bomb) => bomb.update(ticker));
		if (Math.random() < this.spawnRate * (ticker.deltaTime / 60)) this.spawnBomb();
		this.updateUI();
	}

	private spawnBomb() {
		if (!this.isPlaying) return;
		const bomb = new Bomb(
			this,
			this.assets.textures.idle,
			this.assets.textures.explosion,
			this.speed,
			Math.random() * config.game.bombAngleVariance * 2 - config.game.bombAngleVariance,
		);
		bomb.width = config.game.bombSize.width;
		bomb.height = config.game.bombSize.height;
		this.bombs.push(bomb);
		this.app.stage.addChild(bomb);
	}

	public catchBomb(bomb: Bomb) {
		this.handleBomb(bomb, () => {
			this.score++;
			this.increaseDifficulty();
			this.assets.sounds.catch?.play();
			// Add catch animation
			gsap.to(bomb.scale, {
				x: config.animation.bombCatchScale,
				y: config.animation.bombCatchScale,
				duration: config.animation.bombCatchDuration,
				onComplete: () => bomb.destroy(),
			});
		});
	}

	public explodeBomb(bomb: Bomb) {
		if (bomb.hasExploded) return;
		this.handleBomb(bomb, () => {
			this.lives = Math.max(0, this.lives - 1);
			this.assets.sounds.explode?.play();
			this.shakeScreen();
			if (this.lives <= 0) this.endGame();
		});
	}

	private shakeScreen() {
		gsap.to(this.app.stage.position, {
			x: `+=${config.animation.screenShakeIntensity}`,
			y: `+=${config.animation.screenShakeIntensity}`,
			duration: config.animation.screenShakeDuration,
			yoyo: true,
			repeat: 1,
			onComplete: () => {
				this.app.stage.position.set(0, 0);
			},
		});
	}

	private handleBomb(bomb: Bomb, callback: () => void) {
		bomb.explode();
		bomb.onComplete = () => {
			this.app.stage.removeChild(bomb);
			this.bombs = this.bombs.filter((b) => b !== bomb);
			callback();
			this.updateUI();
		};
	}

	private increaseDifficulty() {
		this.spawnRate = Math.min(config.difficulty.maxSpawnRate, this.spawnRate + config.difficulty.spawnRateIncrease);
		this.speed = Math.min(config.difficulty.maxSpeed, this.speed + config.difficulty.speedIncrease);
	}

	private updateUI() {
		this.ui.updateText('score', `Score: ${this.score}`);
		this.ui.updateText('lives', `Lives: ${this.lives}`);
		this.ui.updateText('spawnRate', `Spawn Rate: ${this.spawnRate.toFixed(2)}`);
		this.ui.updateText('speed', `Speed: ${this.speed.toFixed(2)}`);
	}

	private endGame() {
		this.bombs.forEach((bomb) => bomb.explode());
		this.isPlaying = false;
		const gameOver = this.ui.createText('gameOver', `Game Over! Score: ${this.score}`, config.canvas.width / 2, config.canvas.height / 2 - 50, {
			fill: '#ff0000',
			fontSize: 48,
		});
		gameOver.anchor.set(0.5);
		this.ui.createButton('Replay', config.canvas.width / 2, config.canvas.height / 2 + 50, () => this.restartGame());
		this.assets.sounds.gameover?.play();
	}

	private restartGame() {
		this.ui.clear();
		this.bombs = [];
		this.resetState();
		this.setupUI();
		this.setupFloor();
		this.isPlaying = true;
	}

	private resetState() {
		this.lives = config.game.initialLives;
		this.score = 0;
		this.spawnRate = config.game.initialSpawnRate;
		this.speed = config.game.initialSpeed;
		this.updateUI();
	}
}

class Bomb extends AnimatedSprite {
	private vx: number;
	private vy: number;
	private game: Game;
	private explosionTextures: Texture[];
	public hasExploded: boolean = false;
	public onComplete?: () => void;

	constructor(game: Game, textures: Texture[], explosionTextures: Texture[], speed: number, angle: number) {
		super(textures);
		this.game = game;
		this.explosionTextures = explosionTextures;
		this.anchor.set(0.5);
		this.x = Math.random() * config.canvas.width;
		this.y = 0;
		this.vx = speed * Math.sin((angle * Math.PI) / 180);
		this.vy = speed * Math.cos((angle * Math.PI) / 180);
		this.interactive = true;
		this.cursor = 'pointer';
		this.on('pointerdown', () => this.game.catchBomb(this));
		this.animationSpeed = 1;
		this.loop = true;
		this.play();
		this.on('complete', () => this.onComplete?.());
	}

	update(ticker: Ticker) {
		super.update(ticker);
		this.x += this.vx * ticker.deltaTime;
		this.y += this.vy * ticker.deltaTime;
		this.rotation += config.game.bombRotationSpeed * ticker.deltaTime;

		if (this.x < 0) this.vx = Math.abs(this.vx);
		else if (this.x > config.canvas.width) this.vx = -Math.abs(this.vx);
		if (this.y > config.canvas.height - config.canvas.floorHeight) this.game.explodeBomb(this);
	}

	public explode() {
		if (this.hasExploded) return;
		this.hasExploded = true;
		this.textures = this.explosionTextures;
		this.loop = false;
		this.animationSpeed = 0.5;
		this.play();
	}
}

(async () => {
	const app = new Application();
	await app.init({
		width: config.canvas.width,
		height: config.canvas.height,
		background: '#1099bb',
	});
	document.getElementById('game')!.appendChild(app.canvas);

	const assets = await AssetLoader.load();
	new Game(app, assets);
})();
