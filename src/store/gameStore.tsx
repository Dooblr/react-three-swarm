import { create } from 'zustand'

interface GameState {
  isPaused: boolean
  credits: number
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
  maxJumps: number
  setPaused: (paused: boolean) => void
  setCredits: (credits: number | ((prev: number) => number)) => void
  incrementCredits: () => void
  setFireRate: (rate: number) => void
  incrementPowerups: () => void
  setHealth: (health: number) => void
  decrementHealth: () => void
  setAudioLevel: (type: keyof GameState['audioLevels'], level: number) => void
  purchaseHealth: () => boolean
  purchaseAttackSpeed: () => boolean
  setMaxJumps: (jumps: number) => void
  purchaseTripleJump: () => boolean
}

export const useGameStore = create<GameState>((set) => ({
  isPaused: false,
  credits: 0,
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
  maxJumps: 2,
  setPaused: (paused) => set({ isPaused: paused }),
  setCredits: (credits) => set((state) => ({ 
    credits: typeof credits === 'function' ? credits(state.credits) : credits 
  })),
  incrementCredits: () => set((state) => ({ credits: state.credits + 1 })),
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
  purchaseHealth: () => {
    let success = false;
    set((state) => {
      if (state.credits >= 10) {
        success = true;
        return {
          credits: state.credits - 10,
          health: Math.min(100, state.health + 10)
        }
      }
      return state
    });
    return success;
  },
  purchaseAttackSpeed: () => {
    let success = false;
    set((state) => {
      if (state.credits >= 20) {
        success = true;
        return {
          credits: state.credits - 20,
          fireRate: state.fireRate * 1.2
        }
      }
      return state
    });
    return success;
  },
  setMaxJumps: (jumps) => set({ maxJumps: jumps }),
  purchaseTripleJump: () => {
    let success = false;
    set((state) => {
      if (state.credits >= 30) {  // Cost: 30 credits
        success = true;
        return {
          credits: state.credits - 30,
          maxJumps: 3
        }
      }
      return state
    });
    return success;
  },
})) 