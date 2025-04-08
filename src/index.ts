import { Application, Sprite, Texture, AnimatedSprite, Text, TextStyle, Ticker, Assets, Container, Point, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { Sound } from '@pixi/sound';

// Register GSAP PixiPlugin
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI({ Application, Sprite, Texture, AnimatedSprite, Text, TextStyle, Container, Graphics });

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
	private elements: Map<string, Text | Container> = new Map();

	// Reusable text styles
	private static primaryTextStyle = new TextStyle({
		fontFamily: 'Arial',
		fontSize: 24,
		fontWeight: 'bold',
		fill: '#ffffff',
		stroke: { color: '#000000', width: 4, join: 'round' },
		dropShadow: { color: '#000000', blur: 4, distance: 2, alpha: 0.4 },
		align: 'left',
	});

	private static secondaryTextStyle = new TextStyle({
		fontFamily: 'Arial',
		fontSize: 18,
		fill: '#dddddd',
		stroke: { color: '#000000', width: 2 },
		align: 'left',
	});

	private static titleTextStyle = new TextStyle({
		fontFamily: 'Arial',
		fontSize: 48,
		fontWeight: 'bold',
		fill: '#ffff00',
		stroke: { color: '#000000', width: 6, join: 'round' },
		dropShadow: { color: '#000000', blur: 5, distance: 3, alpha: 0.5 },
		align: 'center',
	});

	private static buttonTextStyle = new TextStyle({
		fontFamily: 'Arial',
		fontSize: 36,
		fontWeight: 'bold',
		fill: '#ffffff',
		stroke: { color: '#333333', width: 5, join: 'round' },
		dropShadow: { color: '#000000', blur: 3, distance: 2, alpha: 0.5 },
		align: 'center',
	});

	private static leaderboardTextStyle = new TextStyle({
		fontFamily: 'Courier New', // Monospaced for alignment
		fontSize: 20,
		fill: '#ffffff',
		align: 'center',
		lineHeight: 28,
	});

	constructor(stage: Container) {
		this.stage = stage;
	}

	createText(id: string, content: string, x: number, y: number, style: TextStyle = UIManager.primaryTextStyle, anchor: Point = new Point(0, 0)): Text {
		if (this.elements.has(id)) this.elements.delete(id);

		const text = new Text({ text: content, style });
		text.position.set(x, y);
		text.anchor.copyFrom(anchor);
		this.elements.set(id, text);
		this.stage.addChild(text);
		return text;
	}

	createButton(id: string, label: string, x: number, y: number, onClick: () => void): Text {
		const button = this.createText(id, label, x, y, UIManager.buttonTextStyle, new Point(0.5, 0.5));
		button.eventMode = 'static';
		button.cursor = 'pointer';
		button.on('pointerdown', onClick);

		// Hover effect
		button.on('pointerover', () => gsap.to(button, { pixi: { scale: 1.1 }, duration: 0.1 }));
		button.on('pointerout', () => gsap.to(button, { pixi: { scale: 1.0 }, duration: 0.1 }));

		return button;
	}

	updateText(id: string, content: string) {
		const element = this.elements.get(id);
		if (element && element instanceof Text) element.text = content;
	}

	animateElement(id: string, animationProps: gsap.TweenVars) {
		const element = this.elements.get(id);
		if (element) gsap.to(element, animationProps);
	}

	clear() {
		this.elements.forEach((element) => element.destroy());
		this.elements.clear();
	}

	showStartScreen(onStartClick: () => void) {
		this.clear();
		this.createText('title', 'Bomb Catcher', config.canvas.width / 2, config.canvas.height / 3, UIManager.titleTextStyle, new Point(0.5, 0.5));
		this.createButton('startButton', 'Start Game', config.canvas.width / 2, config.canvas.height / 2 + 50, onStartClick);
	}

	showGameUI(initialScore: number, initialLives: number) {
		this.createText('scoreLabel', `Score: ${initialScore}`, 70, 20, UIManager.primaryTextStyle, new Point(0.5, 0.5));
		this.createText('livesLabel', `Lives: ${initialLives}`, 70, 55, UIManager.primaryTextStyle, new Point(0.5, 0.5));
		// Optional: Display difficulty stats for debugging/info
		this.createText('spawnRateLabel', `Spawn Rate: ...`, 20, 90, UIManager.secondaryTextStyle);
		this.createText('speedLabel', `Speed: ...`, 20, 115, UIManager.secondaryTextStyle);
	}

	showGameOverScreen(finalScore: number, leaderboard: string, onReplayClick: () => void) {
		const overlay = new Graphics().rect(0, 0, config.canvas.width, config.canvas.height).fill({ color: 0x000000, alpha: 0.5 });
		this.stage.addChild(overlay);
		this.elements.set('gameOverOverlay', overlay); // Manage overlay

		this.createText('gameOverTitle', `Game Over!`, config.canvas.width / 2, config.canvas.height / 2 - 150, UIManager.titleTextStyle, new Point(0.5, 0.5));
		this.createText(
			'finalScoreLabel',
			`Final Score: ${finalScore}`,
			config.canvas.width / 2,
			config.canvas.height / 2 - 80,
			UIManager.primaryTextStyle,
			new Point(0.5, 0.5),
		);
		this.createButton('replayButton', 'Replay', config.canvas.width / 2, config.canvas.height / 2, onReplayClick);
		this.createText(
			'leaderboard',
			`Top Scores:\n${leaderboard}`,
			config.canvas.width / 2,
			config.canvas.height / 2 + 125,
			UIManager.leaderboardTextStyle,
			new Point(0.5, 0.5),
		);
	}
}

class ScoreManager {
	private _lives: number = config.game.initialLives;
	private _score: number = 0;

	constructor() {
		this.reset();
	}

	reset() {
		this._lives = config.game.initialLives;
		this._score = 0;
	}

	increaseScore(points: number = 1) {
		this._score += points;
	}

	loseLife() {
		this._lives = Math.max(0, this._lives - 1);
	}

	isGameOver(): boolean {
		return this._lives <= 0;
	}

	/** Saves the current score to the leaderboard in localStorage */
	registerScore() {
		try {
			const scores = this.loadScores();
			scores.push(this._score);
			scores.sort((a, b) => b - a); // Sort descending
			const updatedScores = scores.slice(0, config.leaderboard.maxEntries);
			localStorage.setItem(config.leaderboard.storageKey, JSON.stringify(updatedScores));
		} catch (error) {
			console.error('Failed to save score to localStorage:', error);
		}
	}

	/** Retrieves the formatted leaderboard string */
	getLeaderboard(): string {
		try {
			const scores = this.loadScores();
			if (scores.length === 0) return 'No scores yet!';
			return scores.map((score, i) => `${(i + 1).toString().padStart(2)}. ${score.toString().padStart(6)}`).join('\n');
		} catch (error) {
			console.error('Failed to load scores from localStorage:', error);
			return 'Error loading scores';
		}
	}

	/** Loads scores from localStorage */
	private loadScores(): number[] {
		const storedScores = localStorage.getItem(config.leaderboard.storageKey);
		return storedScores ? JSON.parse(storedScores) : [];
	}

	get lives(): number {
		return this._lives;
	}
	get score(): number {
		return this._score;
	}
}

class Game {
	private app: Application;
	private assets: LoadedAssets;
	private bombs: Bomb[] = [];
	private spawnRate: number = config.game.initialSpawnRate;
	private speed: number = config.game.initialSpeed;
	private isPlaying: boolean = false;
	private ui: UIManager;
	private scoreManager: ScoreManager;

	constructor(app: Application, assets: LoadedAssets) {
		this.app = app;
		this.assets = assets;
		this.ui = new UIManager(app.stage);
		this.scoreManager = new ScoreManager();
		this.ui.showStartScreen(() => this.startGame());
		this.setupFloor();
	}

	private async setupFloor() {
		const floor = new Sprite(this.assets.textures.floor);
		floor.width = config.canvas.width;
		floor.height = config.canvas.floorHeight;
		floor.y = config.canvas.height - config.canvas.floorHeight;
		this.app.stage.addChild(floor);
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
		if (!this.isPlaying) return;
		this.handleBomb(bomb, () => {
			this.scoreManager.increaseScore();
			this.ui.updateText('scoreLabel', `Score: ${this.scoreManager.score}`);
			this.ui.animateElement('scoreLabel', {
				pixi: { scale: 1.2 },
				duration: 0.1,
				yoyo: true,
				repeat: 1,
				ease: 'power1.inOut',
			});
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
		if (bomb.hasExploded || !this.isPlaying) return;
		this.handleBomb(bomb, () => {
			this.scoreManager.loseLife();
			this.ui.updateText('livesLabel', `Lives: ${this.scoreManager.lives}`);
			this.ui.animateElement('livesLabel', {
				pixi: { scale: 0.8 },
				duration: 0.1,
				yoyo: true,
				repeat: 1,
				ease: 'power1.inOut',
			});
			this.assets.sounds.explode?.play();
			this.screenShake();
			if (this.scoreManager.isGameOver() && this.isPlaying) this.endGame();
		});
	}

	private screenShake(): void {
		const intensity = config.animation.screenShakeIntensity;
		gsap.to(this.app.stage, {
			x: `random(-${intensity}, ${intensity})`, // GSAP random string
			y: `random(-${intensity}, ${intensity})`,
			duration: config.animation.screenShakeDuration,
			repeat: 3, // Number of shakes
			yoyo: true,
			ease: 'power1.inOut',
			onComplete: () => {
				// Ensure stage returns exactly to 0,0
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
		};
	}

	private increaseDifficulty() {
		this.spawnRate = Math.min(config.difficulty.maxSpawnRate, this.spawnRate + config.difficulty.spawnRateIncrease);
		this.speed = Math.min(config.difficulty.maxSpeed, this.speed + config.difficulty.speedIncrease);
		this.updateDifficultyUI();
	}

	private updateDifficultyUI(): void {
		this.ui.updateText('spawnRateLabel', `Spawn Rate: ${this.spawnRate.toFixed(2)}/s`);
		this.ui.updateText('speedLabel', `Speed: ${this.speed.toFixed(2)}`);
	}

	private endGame() {
		this.isPlaying = false;
		this.bombs.forEach((bomb) => bomb.explode());
		this.scoreManager.registerScore();
		this.assets.sounds.gameover?.play();
		this.ui.showGameOverScreen(this.scoreManager.score, this.scoreManager.getLeaderboard(), () => this.restartGame());
	}

	private restartGame() {
		this.bombs = [];
		this.resetState();
		this.isPlaying = true;
	}

	private resetState() {
		this.scoreManager.reset();
		this.spawnRate = config.game.initialSpawnRate;
		this.speed = config.game.initialSpeed;
		this.ui.clear();
		this.ui.showGameUI(this.scoreManager.score, this.scoreManager.lives);
		this.updateDifficultyUI();
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
