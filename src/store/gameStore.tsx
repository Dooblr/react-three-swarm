import { create } from 'zustand'

interface GameState {
  isPaused: boolean
  score: number
  fireRate: number
  powerupsCollected: number
  setPaused: (paused: boolean) => void
  setScore: (score: number | ((prev: number) => number)) => void
  incrementScore: () => void
  setFireRate: (rate: number) => void
  incrementPowerups: () => void
}

export const useGameStore = create<GameState>((set) => ({
  isPaused: false,
  score: 0,
  fireRate: 1,
  powerupsCollected: 0,
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
  })
})) 