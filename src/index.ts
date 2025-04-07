import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

// Game configuration
const CONFIG = {
    WIDTH: 800,
    HEIGHT: 600,
    INITIAL_SPAWN_RATE: 1,
    INITIAL_SPEED: 2,
    LIVES: 9,
    SPAWN_RATE_INCREASE: 0.02,
    SPEED_INCREASE: 0.05,
};

// UI Manager for text and buttons
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
    private lives: number = CONFIG.LIVES;
    private score: number = 0;
    private spawnRate: number = CONFIG.INITIAL_SPAWN_RATE;
    private speed: number = CONFIG.INITIAL_SPEED;
    private isPlaying: boolean = false;
    private ui: UIManager;
    private idleTextures: PIXI.Texture[] = [];
    private explosionTextures: PIXI.Texture[] = [];

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

    private async preloadAssets() {
        this.idleTextures = await Promise.all(
            Array.from({ length: 6 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Idle_00${i}.png`))
        );
        this.explosionTextures = await Promise.all(
            Array.from({ length: 10 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Explosion_00${i}.png`))
        );
    }

    private showStartScreen() {
        this.preloadAssets().then(() => {
            this.ui.createButton('Start', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, () => this.startGame());
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
        const bomb = new Bomb(this, this.idleTextures, this.explosionTextures, this.speed, Math.random() * 60 - 30);
        bomb.width = 50;
        bomb.height = 50;
        this.bombs.push(bomb);
        this.app.stage.addChild(bomb);
    }

    public catchBomb(bomb: Bomb) {
        this.handleBomb(bomb, () => {
            this.score++;
            this.increaseDifficulty();
        });
    }

    public explodeBomb(bomb: Bomb) {
        if (bomb.hasExploded) return;
        this.handleBomb(bomb, () => {
            this.lives = Math.max(0, this.lives - 1);
            if (this.lives <= 0) this.endGame();
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
        this.spawnRate += CONFIG.SPAWN_RATE_INCREASE;
        this.speed += CONFIG.SPEED_INCREASE;
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
        this.ui.createText('gameOver', `Game Over! Score: ${this.score}`, CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 50, { fill: '#ff0000', fontSize: 48, align: 'center' });
        this.ui.createButton('Replay', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 50, () => this.restartGame());
    }

    private restartGame() {
        this.ui.clear();
        this.bombs = [];
        this.resetState();
        this.setupUI();
        this.isPlaying = true;
    }

    private resetState() {
        this.lives = CONFIG.LIVES;
        this.score = 0;
        this.spawnRate = CONFIG.INITIAL_SPAWN_RATE;
        this.speed = CONFIG.INITIAL_SPEED;
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
        this.x = Math.random() * CONFIG.WIDTH;
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
        this.rotation += 0.01 * ticker.deltaTime;

        if (this.x < 0) this.vx = Math.abs(this.vx);
        else if (this.x > CONFIG.WIDTH) this.vx = -Math.abs(this.vx);
        if (this.y > CONFIG.HEIGHT) this.game.explodeBomb(this);
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
    await app.init({ width: CONFIG.WIDTH, height: CONFIG.HEIGHT, background: '#1099bb' });
    document.getElementById('game')!.appendChild(app.canvas);
    new Game(app);
})();