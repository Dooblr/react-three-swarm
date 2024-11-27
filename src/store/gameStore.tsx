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
  hasHomingShots: boolean
  hasSpeedBoost: boolean
  homingEnabled: boolean
  weaponScore: number
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
  purchaseHomingShots: () => boolean
  purchaseSpeedBoost: () => boolean
  toggleHoming: () => void
  setWeaponScore: (score: number) => void
  incrementWeaponScore: () => void
}

export const STORE_PRICES = {
  HEALTH_BOOST: 10,
  ATTACK_SPEED: 20,
  TRIPLE_JUMP: 30,
  HOMING_SHOTS: 50,
  SPEED_BOOST: 50
} as const

export const useGameStore = create<GameState>((set) => ({
  isPaused: false,
  credits: 0,
  fireRate: 1000,  // Base fire rate in milliseconds
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
  hasHomingShots: false,
  hasSpeedBoost: false,
  homingEnabled: true,
  weaponScore: 0,
  setPaused: (paused) => set({ isPaused: paused }),
  setCredits: (credits) => set((state) => ({ 
    credits: typeof credits === 'function' ? credits(state.credits) : credits 
  })),
  incrementCredits: () => set((state) => ({ credits: state.credits + 1 })),
  setFireRate: (rate) => set({ fireRate: rate }),
  incrementPowerups: () => set((state) => ({ 
    fireRate: Math.max(state.fireRate * 0.95, 100)  // 5% faster, with minimum cap
  })),
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
      if (state.credits >= STORE_PRICES.HEALTH_BOOST) {
        success = true;
        return {
          credits: state.credits - STORE_PRICES.HEALTH_BOOST,
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
      if (state.credits >= STORE_PRICES.ATTACK_SPEED) {
        success = true;
        return {
          credits: state.credits - STORE_PRICES.ATTACK_SPEED,
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
      if (state.credits >= STORE_PRICES.TRIPLE_JUMP) {
        success = true;
        return {
          credits: state.credits - STORE_PRICES.TRIPLE_JUMP,
          maxJumps: 3
        }
      }
      return state
    });
    return success;
  },
  purchaseHomingShots: () => {
    let success = false;
    set((state) => {
      if (state.credits >= STORE_PRICES.HOMING_SHOTS && !state.hasHomingShots) {
        success = true;
        return {
          credits: state.credits - STORE_PRICES.HOMING_SHOTS,
          hasHomingShots: true
        }
      }
      return state
    });
    return success;
  },
  purchaseSpeedBoost: () => {
    let success = false;
    set((state) => {
      if (state.credits >= STORE_PRICES.SPEED_BOOST && !state.hasSpeedBoost) {
        success = true;
        return {
          credits: state.credits - STORE_PRICES.SPEED_BOOST,
          hasSpeedBoost: true
        }
      }
      return state
    });
    return success;
  },
  toggleHoming: () => set((state) => ({ homingEnabled: !state.homingEnabled })),
  setWeaponScore: (score) => set({ weaponScore: score }),
  incrementWeaponScore: () => set((state) => {
    const newScore = state.weaponScore + 1;
    
    // Reset fire rate at tier thresholds
    if (newScore === 5 || newScore === 10) {
      return { 
        weaponScore: newScore,
        fireRate: 1000  // Reset to base fire rate at new tier
      };
    }
    
    return { 
      weaponScore: Math.min(newScore, 10)
    };
  }),
}))

export const getGameStore = () => useGameStore.getState()