/**
 * Neon arcade theme for Brick Blast Quest.
 * Dark navy surfaces with cyan / magenta / gold neon accents.
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#eef1ff',
    tint: '#00e5ff',

    // Core surfaces (the game is always dark — neon arcade)
    background: '#0a0e1f',
    foreground: '#eef1ff',

    card: '#141a33',
    cardForeground: '#eef1ff',

    primary: '#00e5ff',
    primaryForeground: '#04121a',

    secondary: '#1c2447',
    secondaryForeground: '#eef1ff',

    muted: '#1a2140',
    mutedForeground: '#8b93b5',

    accent: '#ff2e97',
    accentForeground: '#ffffff',

    destructive: '#ff4d5e',
    destructiveForeground: '#ffffff',

    border: '#232b4d',
    input: '#232b4d',

    // Game-specific neon palette
    gold: '#ffd60a',
    green: '#3dffb4',
    orange: '#ff9f1c',
    purple: '#b388ff',
  },

  radius: 16,
};

export default colors;
