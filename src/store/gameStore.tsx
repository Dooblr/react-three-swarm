import { create } from 'zustand'

interface GameState {
  isPaused: boolean
  score: number
  fireRate: number
  powerupsCollected: number
  health: number
  audioLevels: {
    music: number
    bullet: number
    powerup: number
    enemyHit: number
    enemyDeath: number
    playerHit: number
  }
  setPaused: (paused: boolean) => void
  setScore: (score: number | ((prev: number) => number)) => void
  incrementScore: () => void
  setFireRate: (rate: number) => void
  incrementPowerups: () => void
  setHealth: (health: number) => void
  decrementHealth: () => void
  setAudioLevel: (type: keyof GameState['audioLevels'], level: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  isPaused: false,
  score: 0,
  fireRate: 1,
  powerupsCollected: 0,
  health: 100,
  audioLevels: {
    music: 0.25,     // Background music
    bullet: 0.5,     // Bullet sound
    powerup: 0.3,    // Powerup/health pickup sound
    enemyHit: 0.15,   // Enemy hit sound
    enemyDeath: 0.4,  // Enemy death sound
    playerHit: 0.4    // Player hit sound
  },
  setPaused: (paused) => set({ isPaused: paused }),
  setScore: (score) => set((state) => ({ 
    score: typeof score === 'function' ? score(state.score) : score 
  })),
  incrementScore: () => set((state) => ({ score: state.score + 1 })),
  setFireRate: (rate) => set({ fireRate: rate }),
  incrementPowerups: () => set((state) => {
    const newPowerups = state.powerupsCollected + 1;
    return { 
      powerupsCollected: newPowerups,
      fireRate: state.fireRate * 1.2  // Increase fire rate by 20%
    };
  }),
  setHealth: (health) => set({ health: Math.max(0, Math.min(100, health)) }),
  decrementHealth: () => set((state) => {
    const newHealth = Math.max(0, state.health - 10);
    return { health: newHealth };
  }),
  setAudioLevel: (type, level) => set((state) => ({
    audioLevels: {
      ...state.audioLevels,
      [type]: Math.max(0, Math.min(1, level)) // Clamp between 0 and 1
    }
  })),
})) 