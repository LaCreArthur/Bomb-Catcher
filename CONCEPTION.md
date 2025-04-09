# Conception du Jeu Bomb Catcher

## Mécaniques de Jeu

### Bombes

- Les bombes tombent du haut de l'écran avec un angle aléatoire
- Elles rebondissent sur les bords latéraux de l'écran
- Si une bombe atteint le sol, elle explose et le joueur perd une vie
- Le joueur peut attraper une bombe en cliquant dessus

### Progression de la Difficulté

- La vitesse de chute des bombes augmente progressivement
- La fréquence d'apparition des bombes augmente également
- Ces augmentations sont basées sur le score du joueur

### Système de Vies

- Le joueur commence avec 9 vies
- Une vie est perdue chaque fois qu'une bombe touche le sol
- La partie se termine lorsque toutes les vies sont perdues

## Architecture Technique

### Structure des Classes

- **Game**: Classe principale qui gère l'état du jeu et la logique générale
- **Bomb**: Gère le comportement des bombes individuelles
- **UIManager**: Gère l'interface utilisateur
- **ParticleEmitter**: Système de particules pour les effets visuels

### Gestion des Assets

- Les textures sont chargées au démarrage via l'Assets Loader de Pixi.js
- Les sons sont gérés par @pixi/sound
- Les animations utilisent GSAP

### Optimisations

- Utilisation d'un objet de configuration unique (`config.ts`)
- Gestion d'états simples (`GameState`), d'événements et nettoyage des ressources
- Séparation des logiques des bombes, de l'ui, et de l'état du jeu

## Évolutions Possibles

- Différents types de bombes (taille et vitesse variables, explose en bombes multiples, etc.)
- Système de power-ups (ralentir le temps, attraper automatiquement les bombes, etc.)
- Environnements interactifs (vent qui affecte la trajectoire, nuage qui baisse la visibilitée, etc.)
- Système de combo en attrapant plusieurs bombes consécutives sans en laisser tomber une
- Mode multijoueur compétitif ou coopératif
- Système de vagues et de boss nécessite plusieurs clics
