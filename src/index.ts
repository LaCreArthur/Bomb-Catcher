import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { AnimatedSprite, Application, Container, Graphics, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { GameAssets, loadAssets } from './assets';
import { Bomb } from './bomb';
import { config } from './config';
import { ParticleEmitter } from './particles';
import { UIManager } from './ui-manager';

// Register GSAP PixiPlugin
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI({ Application, Texture, Sprite, AnimatedSprite, Text, TextStyle, Container, Graphics });

// Game states
enum GameState {
	Loading,
	Ready,
	Playing,
	GameOver,
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

	private bombs: Bomb[] = [];
	particleEmitter: ParticleEmitter;

	constructor(app: Application, assets: GameAssets) {
		this.app = app;
		this.assets = assets;
		this.ui = new UIManager(app.stage);

		this.particleEmitter = new ParticleEmitter(app.stage);
		this.createBackground(app);
		this.createFloor(assets, app);
		this.showStartScreen();
	}

	private createFloor(assets: GameAssets, app: Application) {
		const floor = new Sprite(assets.textures.floor);
		floor.width = config.canvasWidth + config.screenShakeIntensity * 2; // Extend slightly beyond canvas width to cover the screen shake effect
		floor.height = config.floorHeight;
		floor.x = -config.screenShakeIntensity; // Center the floor
		floor.y = config.canvasHeight - config.floorHeight + config.screenShakeIntensity;
		app.stage.addChild(floor);
	}

	private createBackground(app: Application) {
		const background = new Sprite(this.assets.textures.background);
		background.width = config.canvasWidth + config.screenShakeIntensity * 2;
		background.height = config.canvasHeight + config.screenShakeIntensity * 2;
		background.x = -config.screenShakeIntensity;
		background.y = -config.screenShakeIntensity;
		app.stage.addChild(background);
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

		// Play sound
		this.assets.sounds.catch?.play();

		// Create particles at bomb position
		this.particleEmitter.emit(bomb.x, bomb.y, 20, {
			color: 0xffd700, // Gold color for catch
			minSpeed: 2,
			maxSpeed: 8,
			lifetime: 0.7,
		});

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

		this.assets.sounds.explode?.play();
		bomb.explode();

		this.ui.shakeScreen();

		this.lives--;
		this.ui.updateText('livesLabel', `Lives: ${this.lives}`);
		this.ui.animateElement('livesLabel', {
			pixi: { scale: 0.8 },
			duration: 0.1,
			yoyo: true,
			repeat: 1,
		});

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
		backgroundColor: 0x092e5b,
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
