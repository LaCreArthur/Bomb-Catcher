import { Sound } from '@pixi/sound';
import { Assets, Texture } from 'pixi.js';
import { config } from './config';

// Asset types
export type GameAssets = {
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
export async function loadAssets(): Promise<GameAssets> {
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
