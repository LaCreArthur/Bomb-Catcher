import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

class Game {
    private app: PIXI.Application;
    private bombs: Bomb[] = [];
    private lives: number = 9;
    private score: number = 0;
    private currentSpawnRate: number = 1; // Bombs per second
    private currentSpeed: number = 2; // Initial speed
    private initialSpawnRate: number = 1;
    private initialSpeed: number = 2;
    private isPlaying: boolean = false;
    // UI elements
    private scoreText: PIXI.Text;
    private livesText: PIXI.Text;
    private spawnRateText: PIXI.Text;
    private speedText: PIXI.Text;
    // Textures for animations
    private idleTextures: PIXI.Texture[] = [];
    private explosionTextures: PIXI.Texture[] = [];

    constructor(app: PIXI.Application) {
        this.app = app;
        this.scoreText = this.createText(`Score: ${this.score}`, 10, 10);
        this.livesText = this.createText(`Lives: ${this.lives}`, 10, 40);
        this.spawnRateText = this.createText(`Spawn Rate: ${this.currentSpawnRate.toFixed(2)}`, 10, 70);
        this.speedText = this.createText(`Speed: ${this.currentSpeed.toFixed(2)}`, 10, 100);
        this.setupUI();
        this.showStartScreen();
    }

    private createText(content: string, x: number, y: number): PIXI.Text {
        const text = new PIXI.Text({ text: content, style: { fill: '#ffffff' } });
        text.x = x;
        text.y = y;
        return text;
    }

    private setupUI() {
        this.app.stage.addChild(this.scoreText, this.livesText, this.spawnRateText, this.speedText);
    }

    private async preloadAssets() {
        console.log('Starting asset preload');
        this.idleTextures = await Promise.all(
            Array.from({ length: 6 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Idle_00${i}.png`))
        );
        this.explosionTextures = await Promise.all(
            Array.from({ length: 10 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Explosion_00${i}.png`))
        );
        console.log('Assets preloaded');
    }

    private showStartScreen() {
        this.preloadAssets().then(() => {
            const startButton = this.createText('Start', 400, 300);
            startButton.anchor.set(0.5);
            startButton.interactive = true;
            startButton.cursor = 'pointer';
            startButton.on('pointerdown', () => {
                this.app.stage.removeChild(startButton);
                this.startGame();
            });
            this.app.stage.addChild(startButton);
        });
    }

    private startGame() {
        this.resetGameState();
        this.app.ticker.add((delta) => this.update(delta));
        this.isPlaying = true;
        console.log('Game started');
    }

    private update(ticker: PIXI.Ticker) {
        if (!this.isPlaying) return;
        this.bombs.forEach((bomb) => bomb.update(ticker));
        if (Math.random() < this.currentSpawnRate * (ticker.deltaTime / 60)) {
            this.spawnBomb();
        }
        this.updateUI();
    }

    private spawnBomb() {
        if (!this.isPlaying) return;
        const bomb = new Bomb(this, this.idleTextures, this.explosionTextures, this.currentSpeed, Math.random() * 60 - 30, this.app.screen.width, this.app.screen.height);
        bomb.width = 50;
        bomb.height = 50;
        this.bombs.push(bomb);
        this.app.stage.addChild(bomb);
        console.log('Bomb spawned');
    }

    public catchBomb(bomb: Bomb) {
        this.handleBombExplosion(bomb, () => {
            this.score += 1;
            this.increaseDifficulty();
            this.updateUI();
            console.log('Bomb caught, score updated');
        });
    }

    public explodeBomb(bomb: Bomb) {
        if (bomb.hasExploded) return;
        this.handleBombExplosion(bomb, () => {
            this.lives = Math.max(0, this.lives - 1); // Prevent negative lives
            if (this.lives <= 0) this.endGame();
            this.updateUI();
            console.log('Bomb exploded, lives updated');
        });
    }

    private handleBombExplosion(bomb: Bomb, callback: () => void) {
        bomb.explode();
        bomb.onComplete = () => {
            this.app.stage.removeChild(bomb);
            this.bombs = this.bombs.filter((b) => b !== bomb);
            callback();
        };
    }

    private increaseDifficulty() {
        this.currentSpawnRate += 0.02; // More bombs
        this.currentSpeed += 0.05; // Faster
        console.log(`Difficulty increased: spawnRate=${this.currentSpawnRate}, speed=${this.currentSpeed}`);
    }

    private updateUI() {
        this.scoreText.text = `Score: ${this.score}`;
        this.livesText.text = `Lives: ${this.lives}`;
        this.spawnRateText.text = `Spawn Rate: ${this.currentSpawnRate.toFixed(2)}`;
        this.speedText.text = `Speed: ${this.currentSpeed.toFixed(2)}`;
    }

    private endGame() {
        this.bombs.forEach(bomb => bomb.explode());
        this.isPlaying = false;

        const gameOverText = this.createText(`Game Over! Score: ${this.score}`, 400, 250);
        gameOverText.anchor.set(0.5);
        gameOverText.style = { fill: '#ff0000', fontSize: 48 };
        this.app.stage.addChild(gameOverText);

        const replayButton = this.createText('Replay', 400, 350);
        replayButton.anchor.set(0.5);
        replayButton.style = { fill: '#ffffff', fontSize: 36 };
        replayButton.interactive = true;
        replayButton.cursor = 'pointer';
        replayButton.on('pointerdown', () => this.restartGame());
        this.app.stage.addChild(replayButton);
        console.log('Game over');
    }

    private restartGame() {
        this.app.stage.removeChildren();
        this.bombs = [];
        this.resetGameState();
        this.setupUI();
        this.isPlaying = true;
        console.log('Game restarted');
    }

    private resetGameState() {
        this.lives = 9;
        this.score = 0;
        this.currentSpawnRate = this.initialSpawnRate;
        this.currentSpeed = this.initialSpeed;
        this.updateUI();
    }
}

class Bomb extends PIXI.AnimatedSprite {
    private vx: number;
    private vy: number;
    private screenWidth: number;
    private screenHeight: number;
    private game: Game;
    private explosionTextures: PIXI.Texture[];
    public hasExploded: boolean = false;
    public onComplete?: () => void;

    constructor(game: Game, textures: PIXI.Texture[], explosionTextures: PIXI.Texture[], speed: number, angle: number, screenWidth: number = 800, screenHeight: number = 600) {
        super(textures);
        this.game = game;
        this.explosionTextures = explosionTextures;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.anchor.set(0.5);
        this.x = Math.random() * screenWidth;
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

        if (this.x < 0) {
            this.x = 0;
            this.vx = -this.vx;
        } else if (this.x > this.screenWidth) {
            this.x = this.screenWidth;
            this.vx = -this.vx;
        }

        if (this.y > this.screenHeight) this.game.explodeBomb(this);
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
        width: 800,
        height: 600,
        background: '#1099bb',
    });
    document.getElementById('game')!.appendChild(app.canvas);
    const game = new Game(app);
})();