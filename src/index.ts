import * as PIXI from 'pixi.js';
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
    }
};

class UIManager {
    private stage: PIXI.Container;
    private texts: Map<string, PIXI.Text> = new Map();

    constructor(stage: PIXI.Container) {
        this.stage = stage;
    }

    createText(id: string, content: string, x: number, y: number, style?: Partial<PIXI.TextStyle>) {
        const text = new PIXI.Text({ text: content, style: { fill: '#ffffff', ...style } });
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
    private app: PIXI.Application;
    private bombs: Bomb[] = [];
    private lives: number = config.game.initialLives;
    private score: number = 0;
    private spawnRate: number = config.game.initialSpawnRate;
    private speed: number = config.game.initialSpeed;
    private isPlaying: boolean = false;
    private ui: UIManager;
    private idleTextures: PIXI.Texture[] = [];
    private explosionTextures: PIXI.Texture[] = [];
    private sounds: { [key: string]: Sound } = {};

    constructor(app: PIXI.Application) {
        this.app = app;
        this.ui = new UIManager(app.stage);
        this.setupUI();
        this.showStartScreen();
    }

    private setupUI() {
        this.ui.createText('score', `Score: ${this.score}`, 10, 10);
        this.ui.createText('lives', `Lives: ${this.lives}`, 10, 40);
        this.ui.createText('spawnRate', `Spawn Rate: ${this.spawnRate.toFixed(2)}`, 10, 70);
        this.ui.createText('speed', `Speed: ${this.speed.toFixed(2)}`, 10, 100);
    }

    private async setupFloor() {
        try {
            const floorTexture = await PIXI.Assets.load(config.assets.floor);
            const floor = new PIXI.Sprite(floorTexture);
            floor.width = config.canvas.width;
            floor.height = config.canvas.floorHeight;
            floor.y = config.canvas.height - config.canvas.floorHeight;
            this.app.stage.addChild(floor);
        } catch (error) {
            console.error('Failed to load floor texture:', error);
        }
    }

    private async customizeCursor() {
        try {
            const cursorTexture = await PIXI.Assets.load('assets/cursor.png');
            this.app.renderer.events.cursorStyles['pointer'] = `url(${cursorTexture.source.resource.src}), auto`;
        } catch (error) {
            console.error('Failed to load cursor texture:', error);
        }
    }

    private async preloadAssets() {
        try {
            const [idle, explosion] = await Promise.all([
                Promise.all(Array.from({ length: config.assets.bombIdleFrames }, (_, i) => 
                    PIXI.Assets.load(`${config.assets.bombIdlePrefix}${i}.png`))),
                Promise.all(Array.from({ length: config.assets.bombExplosionFrames }, (_, i) => 
                    PIXI.Assets.load(`${config.assets.bombExplosionPrefix}${i}.png`))),
                PIXI.Assets.load(config.assets.floor),
                PIXI.Assets.load('assets/cursor.png'),
                Sound.from(config.assets.sounds.catch),
                Sound.from(config.assets.sounds.explode),
                Sound.from(config.assets.sounds.gameover),
            ]);
            this.idleTextures = idle;
            this.explosionTextures = explosion;
            this.sounds = {
                catch: Sound.from(config.assets.sounds.catch),
                explode: Sound.from(config.assets.sounds.explode),
                gameover: Sound.from(config.assets.sounds.gameover),
            };
            this.sounds.explode.volume = 0.66;
            await Promise.all([this.setupFloor(), this.customizeCursor()]);
        } catch (error) {
            console.error('Asset loading failed:', error);
        }
    }

    private showStartScreen() {
        this.preloadAssets().then(() => {
            this.ui.createButton('Start', config.canvas.width / 2, config.canvas.height / 2, () => this.startGame());
        });
    }

    private startGame() {
        this.resetState();
        this.app.ticker.add((delta) => this.update(delta));
        this.isPlaying = true;
    }

    private update(ticker: PIXI.Ticker) {
        if (!this.isPlaying) return;
        this.bombs.forEach(bomb => bomb.update(ticker));
        if (Math.random() < this.spawnRate * (ticker.deltaTime / 60)) this.spawnBomb();
        this.updateUI();
    }

    private spawnBomb() {
        if (!this.isPlaying) return;
        const bomb = new Bomb(
            this, 
            this.idleTextures, 
            this.explosionTextures, 
            this.speed, 
            Math.random() * config.game.bombAngleVariance * 2 - config.game.bombAngleVariance
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
            this.sounds.catch.play();
            // Add catch animation
            gsap.to(bomb.scale, {
                x: config.animation.bombCatchScale,
                y: config.animation.bombCatchScale,
                duration: config.animation.bombCatchDuration,
                onComplete: () => bomb.destroy()
            });
        });
    }

    public explodeBomb(bomb: Bomb) {
        if (bomb.hasExploded) return;
        this.handleBomb(bomb, () => {
            this.lives = Math.max(0, this.lives - 1);
            this.sounds.explode.play();
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
            }
        });
    }

    private handleBomb(bomb: Bomb, callback: () => void) {
        bomb.explode();
        bomb.onComplete = () => {
            this.app.stage.removeChild(bomb);
            this.bombs = this.bombs.filter(b => b !== bomb);
            callback();
            this.updateUI();
        };
    }

    private increaseDifficulty() {
        this.spawnRate = Math.min(
            config.difficulty.maxSpawnRate,
            this.spawnRate + config.difficulty.spawnRateIncrease
        );
        this.speed = Math.min(
            config.difficulty.maxSpeed,
            this.speed + config.difficulty.speedIncrease
        );
    }

    private updateUI() {
        this.ui.updateText('score', `Score: ${this.score}`);
        this.ui.updateText('lives', `Lives: ${this.lives}`);
        this.ui.updateText('spawnRate', `Spawn Rate: ${this.spawnRate.toFixed(2)}`);
        this.ui.updateText('speed', `Speed: ${this.speed.toFixed(2)}`);
    }

    private endGame() {
        this.bombs.forEach(bomb => bomb.explode());
        this.isPlaying = false;
        const gameOver = this.ui.createText(
            'gameOver', 
            `Game Over! Score: ${this.score}`, 
            config.canvas.width / 2, 
            config.canvas.height / 2 - 50, 
            { fill: '#ff0000', fontSize: 48 }
        );
        gameOver.anchor.set(0.5);
        this.ui.createButton('Replay', config.canvas.width / 2, config.canvas.height / 2 + 50, () => this.restartGame());
        this.sounds.gameover.play();
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

class Bomb extends PIXI.AnimatedSprite {
    private vx: number;
    private vy: number;
    private game: Game;
    private explosionTextures: PIXI.Texture[];
    public hasExploded: boolean = false;
    public onComplete?: () => void;

    constructor(game: Game, textures: PIXI.Texture[], explosionTextures: PIXI.Texture[], speed: number, angle: number) {
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

    update(ticker: PIXI.Ticker) {
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
    const app = new PIXI.Application();
    await app.init({ 
        width: config.canvas.width, 
        height: config.canvas.height, 
        background: '#1099bb' 
    });
    document.getElementById('game')!.appendChild(app.canvas);
    new Game(app);
})();