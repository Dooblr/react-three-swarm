import { create } from 'zustand'

interface GameState {
  isPaused: boolean
  masterVolume: number
  isMuted: boolean
  setPaused: (paused: boolean) => void
  togglePause: () => void
  setMasterVolume: (volume: number) => void
  toggleMute: () => void
  previousVolume: number
}

export const useGameState = create<GameState>((set) => ({
  isPaused: false,
  masterVolume: 0.5,
  isMuted: false,
  previousVolume: 0.5,

  setPaused: (paused) => set({ isPaused: paused }),
  
  togglePause: () => set((state) => ({ 
    isPaused: !state.isPaused 
  })),
  
  setMasterVolume: (volume) => set((state) => ({ 
    masterVolume: Math.max(0, Math.min(1, volume)),
    isMuted: volume === 0,
    previousVolume: volume > 0 ? volume : state.previousVolume
  })),
  
  toggleMute: () => set((state) => ({ 
    isMuted: !state.isMuted,
    masterVolume: state.isMuted ? state.previousVolume : 0
  })),
})) 