import { gsap } from 'gsap';
import { Container, Point, Text, TextStyle } from 'pixi.js';
import { config } from './config';
/**
 * UI Manager class to handle all UI elements
 */
export class UIManager {
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
			fill: '#2fa1c5',
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
