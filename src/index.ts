import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

class Game {
    private app: PIXI.Application;
    private bombs: Bomb[] = [];
    private lives: number = 9;
    private score: number = 0;
    private spawnRate: number = 0.3; // Bombs per second
    private speed: number = 2; // Initial speed
    private scoreText: PIXI.Text;
    private livesText: PIXI.Text;
    // Textures for animations
    private idleTextures: PIXI.Texture[] = [];
    private explosionTextures: PIXI.Texture[] = [];

    constructor(app: PIXI.Application) {
        this.app = app;
        this.scoreText = new PIXI.Text({ text: `Score: ${this.score}`, style: { fill: '#ffffff' } });
        this.livesText = new PIXI.Text({ text: `Lives: ${this.lives}`, style: { fill: '#ffffff' } });
        this.setupUI();
        console.log('Game constructed');
        this.startGame();
    }

    private setupUI() {
        this.scoreText.x = 10;
        this.scoreText.y = 10;
        this.app.stage.addChild(this.scoreText);

        this.livesText.x = 10;
        this.livesText.y = 40;
        this.app.stage.addChild(this.livesText);
    }

    private async preloadAssets() {
        console.log('Starting asset preload');
        this.idleTextures = await Promise.all(
            Array.from({ length: 6 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Idle_00${i}.png`))
        );
        this.explosionTextures = await Promise.all(
            Array.from({ length: 9 }, (_, i) => PIXI.Assets.load(`assets/bomb/Bomb_3_Explosion_00${i}.png`))
        );
        console.log('Assets preloaded');
    }

    private startGame() {
        this.preloadAssets().then(() => {
            console.log('Starting ticker');
            this.app.ticker.add((delta) => this.update(delta));
            this.spawnBomb();
        });
    }

    private update(ticker: PIXI.Ticker) {
        this.bombs.forEach((bomb) => bomb.update(ticker));
        if (Math.random() < this.spawnRate * (ticker.deltaTime / 60)) {
            console.log('Spawning new bomb');
            this.spawnBomb();
        }
    }

    private spawnBomb() {
        // Angle between -30° and 30°
        const bomb = new Bomb(this, this.idleTextures, this.explosionTextures, this.speed, Math.random() * 60 - 30, this.app.screen.width, this.app.screen.height); 
        bomb.width = 50;
        bomb.height = 50;
        this.bombs.push(bomb);
        this.app.stage.addChild(bomb);
        console.log('Bomb spawned');
    }

    public catchBomb(bomb: Bomb) {
        console.log('Catching bomb');
        bomb.explode();
        bomb.onComplete = () => {
            this.app.stage.removeChild(bomb);
            this.bombs = this.bombs.filter((b) => b !== bomb);
            this.score += 1;
            this.scoreText.text = `Score: ${this.score}`;
            this.increaseDifficulty();
            console.log('Bomb caught, score updated');
        };
    }

    public explodeBomb(bomb: Bomb) { 
        if (bomb.hasExploded) return; // Prevent multiple explosions
        console.log('Bomb exploding');
        bomb.explode();
        bomb.onComplete = () => {
            this.bombs = this.bombs.filter((b) => b !== bomb);
            this.app.stage.removeChild(bomb);
            this.lives -= 1;
            this.livesText.text = `Lives: ${this.lives}`;
            if (this.lives <= 0) this.endGame();
            console.log('Bomb exploded, lives updated');
        };
    }

    private increaseDifficulty() {
        this.spawnRate += 0.02; // More bombs
        this.speed += 0.05; // Faster
        console.log(`Difficulty increased: spawnRate=${this.spawnRate}, speed=${this.speed}`);
    }

    private endGame() {
        this.app.ticker.stop();
        const gameOverText = new PIXI.Text({
            text: `Game Over! Score: ${this.score}`,
            style: { fill: '#ff0000', fontSize: 48 },
        });
        gameOverText.x = 400 - gameOverText.width / 2;
        gameOverText.y = 250 - gameOverText.height / 2; // Adjusted for replay button
        this.app.stage.addChild(gameOverText);

        // Add replay button
        const replayButton = new PIXI.Text({
            text: 'Replay',
            style: { fill: '#ffffff', fontSize: 36 },
        });
        replayButton.x = 400 - replayButton.width / 2;
        replayButton.y = 350;
        replayButton.interactive = true;
        replayButton.cursor = 'pointer';
        replayButton.on('pointerdown', () => this.restartGame());
        this.app.stage.addChild(replayButton);

        console.log('Game over');
    }

    private restartGame() {
        // Reset game state
        this.lives = 9;
        this.score = 0;
        this.spawnRate = 0.3;
        this.speed = 2;
        this.livesText.text = `Lives: ${this.lives}`;
        this.scoreText.text = `Score: ${this.score}`;
        this.bombs.forEach(bomb => this.app.stage.removeChild(bomb));
        this.bombs = [];
        this.app.stage.removeChildren(); // Clear stage
        this.setupUI(); // Re-add UI
        this.app.ticker.start();
        this.spawnBomb();
        console.log('Game restarted');
    }
}

class Bomb extends PIXI.AnimatedSprite {
    private vx: number;
    private vy: number;
    private screenWidth: number = 800;
    private screenHeight: number = 600;
    private game: Game;
    private explosionTextures: PIXI.Texture[];
    public hasExploded: boolean = false; // State to prevent multiple explosions
    public onComplete?: () => void;

    constructor(game: Game, textures: PIXI.Texture[], explosionTextures: PIXI.Texture[], speed: number, angle: number, screenWidth: number = 800, screenHeight: number = 600) {
        super(textures);
        this.game = game;
        this.explosionTextures = explosionTextures;
        this.anchor.set(0.5); // Center the sprite
        this.x = Math.random() * 800; // Random position at top
        this.y = 0;
        this.vx = speed * Math.sin((angle * Math.PI) / 180);
        this.vy = speed * Math.cos((angle * Math.PI) / 180);
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.interactive = true;
        this.cursor = 'pointer'; // Cursor on hover
        this.on('pointerdown', () => this.game.catchBomb(this));
        // Animations
        this.animationSpeed = 1; // Idle animation speed
        this.loop = true;
        this.play();
        this.on('complete', () => {
            if (this.onComplete) this.onComplete();
        });
    }

    update(ticker: PIXI.Ticker) {
        super.update(ticker); // Update animation
        this.x += this.vx * ticker.deltaTime;
        this.y += this.vy * ticker.deltaTime;
        this.rotation += 0.01 * ticker.deltaTime; // Bomb rotation

        // Bounce on left and right edges
        if (this.x < 0) {
            this.x = 0; // Reposition at edge
            this.vx = -this.vx; // Reverse horizontal direction
        } else if (this.x > this.screenWidth) {
            this.x = this.screenWidth; // Reposition at edge
            this.vx = -this.vx; // Reverse horizontal direction
        }

        if (this.y > this.screenHeight) this.game.explodeBomb(this); // Bottom of screen
    }

    public explode() {
        if (this.hasExploded) return; // Prevent multiple explosions
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