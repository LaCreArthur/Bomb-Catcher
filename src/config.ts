// Game Configuration
export const config = {
	// Canvas settings
	canvasWidth: 800,
	canvasHeight: 600,
	floorHeight: 50,

	// Game settings
	initialLives: 9,
	initialSpawnRate: 2, // Bombs per second at start
	initialSpeed: 2, // Pixels per frame at start
	bombWidth: 80,
	bombHeight: 80,
	bombAngleVariance: 45, // Degrees +/- from vertical
	bombRotationSpeed: 0.01,

	// Difficulty scaling
	spawnRateIncrease: 0.005,
	speedIncrease: 0.01,
	maxSpawnRate: 5,
	maxSpeed: 10,

	// Animation values
	catchScale: 0.2,
	catchDuration: 0.3,
	explodeDuration: 0.5,
	screenShakeIntensity: 5,
	screenShakeDuration: 0.1,

	// Asset paths
	bombIdlePrefix: 'assets/bomb/Bomb_3_Idle_00',
	bombIdleFrames: 6,
	bombExplosionPrefix: 'assets/bomb/Bomb_3_Explosion_00',
	bombExplosionFrames: 10,
	floorTexture: 'assets/floor.png',
	backgroundTexture: 'assets/background.jpg',

	sounds: {
		catch: 'assets/catch.mp3',
		explode: 'assets/explode.mp3',
		gameover: 'assets/gameover.mp3',
	},

	// Leaderboard
	maxLeaderboardEntries: 5,
	leaderboardKey: 'bombCatcherScores',
};
