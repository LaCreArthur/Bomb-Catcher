import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';

class Game {
    private app: PIXI.Application;
    private bombs: Bomb[] = [];
    private lives: number = 9;
    private score: number = 0;
    private spawnRate: number = 0.1; // Bombes par seconde
    private speed: number = 2; // Vitesse initiale
    private scoreText: PIXI.Text;
    private livesText: PIXI.Text;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.scoreText = new PIXI.Text({ text: `Score: ${this.score}`, style: { fill: '#ffffff' } });
        this.livesText = new PIXI.Text({ text: `Lives: ${this.lives}`, style: { fill: '#ffffff' } });
        this.setupUI();
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

    private startGame() {
        this.app.ticker.add((delta) => this.update(delta.deltaTime));
        this.spawnBomb();
    }

    private update(delta: number) {
        this.bombs.forEach((bomb) => bomb.update(delta));
        if (Math.random() < this.spawnRate * (delta / 60)) this.spawnBomb();
    }

    private async spawnBomb() {
        const texture = await PIXI.Assets.load('assets/bomb.png');
        const bomb = new Bomb(this, texture, this.speed, Math.random() * 60 - 30); // Angle entre -30° et 30°
        bomb.width = 20;
        bomb.height = 20;
        this.bombs.push(bomb);
        this.app.stage.addChild(bomb);
    }

    public catchBomb(bomb: Bomb) {
        gsap.to(bomb, {
            duration: 0.2,
            alpha: 0,
            scale: 0,
            onComplete: () => {
                this.app.stage.removeChild(bomb);
                this.bombs = this.bombs.filter((b) => b !== bomb);
            },
        });
        this.score += 1;
        this.scoreText.text = `Score: ${this.score}`;
        this.increaseDifficulty();
    }

    public explodeBomb(bomb: Bomb) {
        this.bombs = this.bombs.filter((b) => b !== bomb);
        this.app.stage.removeChild(bomb);
        this.lives -= 1;
        this.livesText.text = `Lives: ${this.lives}`;
        if (this.lives <= 0) this.endGame();
    }

    private increaseDifficulty() {
        this.spawnRate += 0.05; // Plus de bombes
        this.speed += 0.1; // Plus rapide
    }

    private endGame() {
        this.app.ticker.stop();
        const gameOverText = new PIXI.Text({
            text: `Game Over! Score: ${this.score}`,
            style: { fill: '#ff0000', fontSize: 48 },
        });
        gameOverText.x = 400 - gameOverText.width / 2;
        gameOverText.y = 300 - gameOverText.height / 2;
        this.app.stage.addChild(gameOverText);
    }
}

class Bomb extends PIXI.Sprite {
    private vx: number;
    private vy: number;
    private game: Game;

    constructor(game: Game, texture: PIXI.Texture, speed: number, angle: number) {
        super(texture);
        this.game = game;
        this.anchor.set(0.5); // Centre le sprite
        this.x = Math.random() * 800; // Position aléatoire en haut
        this.y = 0;
        this.vx = speed * Math.sin((angle * Math.PI) / 180);
        this.vy = speed * Math.cos((angle * Math.PI) / 180);
        this.interactive = true;
        this.cursor = 'pointer'; // Curseur au survol
        this.on('pointerdown', () => this.game.catchBomb(this));
    }

    update(delta: number) {
        this.x += this.vx * delta;
        this.y += this.vy * delta;
        this.rotation += 0.1 * delta; // Rotation des bombes

        // Rebond sur les bords gauche et droit
        if (this.x < 0) {
            this.x = 0; // Repositionne au bord
            this.vx = -this.vx; // Inverse la direction horizontale
        } else if (this.x > 800) {
            this.x = 800; // Repositionne au bord
            this.vx = -this.vx; // Inverse la direction horizontale
        }

        if (this.y > 600) this.game.explodeBomb(this); // Bas de l’écran
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