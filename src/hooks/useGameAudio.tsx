import { useRef, useCallback, useEffect } from 'react'
import { useGameState } from '../store/gameState'
import music1 from '../assets/music_loop.wav'
import music2 from '../assets/music_loop2.wav'

type AudioSources = {
  backgroundMusic1: string
  backgroundMusic2: string
  jump: string
  doubleJump: string
  landing: string
}

const audioSources: AudioSources = {
  backgroundMusic1: music1,
  backgroundMusic2: music2,
  jump: '/audio/jump.mp3',
  doubleJump: '/audio/double-jump.mp3',
  landing: '/audio/landing.mp3',
}

export const useGameAudio = () => {
  const audioElements = useRef<{ [K in keyof AudioSources]?: HTMLAudioElement }>({})
  const currentTrack = useRef<1 | 2>(1)
  const currentAudio = useRef<HTMLAudioElement | null>(null)
  const timeoutRef = useRef<number>()

  const updateAllAudioVolumes = useCallback((masterVolume: number, isMuted: boolean) => {
    Object.entries(audioElements.current).forEach(([key, audio]) => {
      if (audio) {
        const baseVolume = key.includes('backgroundMusic') ? 0.3 : 0.5
        audio.volume = isMuted ? 0 : baseVolume * masterVolume
      }
    })
  }, [])

  const createAudio = useCallback((source: string, volume = 1) => {
    const audio = new Audio(source)
    const { masterVolume, isMuted } = useGameState.getState()
    audio.volume = isMuted ? 0 : volume * masterVolume
    return audio
  }, [])

  useEffect(() => {
    const unsubscribe = useGameState.subscribe(
      (state) => {
        const { masterVolume, isMuted } = state
        updateAllAudioVolumes(masterVolume, isMuted)
      }
    )

    return unsubscribe
  }, [])

  const playBackgroundMusic = useCallback(() => {
    const track1 = audioElements.current.backgroundMusic1 || createAudio(audioSources.backgroundMusic1, 0.3)
    const track2 = audioElements.current.backgroundMusic2 || createAudio(audioSources.backgroundMusic2, 0.3)
    
    audioElements.current.backgroundMusic1 = track1
    audioElements.current.backgroundMusic2 = track2

    const { masterVolume, isMuted } = useGameState.getState()
    updateAllAudioVolumes(masterVolume, isMuted)

    const switchTrack = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }

      if (currentAudio.current) {
        currentAudio.current.pause()
        currentAudio.current.currentTime = 0
      }

      currentTrack.current = currentTrack.current === 1 ? 2 : 1
      currentAudio.current = currentTrack.current === 1 ? track1 : track2
      
      console.log(`Playing track ${currentTrack.current}`)
      currentAudio.current.play()
        .catch(error => console.error('Error playing audio:', error))
    }

    const scheduleNextTrack = () => {
      console.log(`Scheduling next track in 5 seconds`)
      timeoutRef.current = window.setTimeout(switchTrack, 5000)
    }

    // Start with track 1
    currentAudio.current = track1
    currentAudio.current.addEventListener('ended', scheduleNextTrack)
    track2.addEventListener('ended', scheduleNextTrack)
    
    currentAudio.current.play()
      .catch(error => console.error('Error playing initial audio:', error))

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
      if (currentAudio.current) {
        currentAudio.current.pause()
        currentAudio.current.currentTime = 0
      }
      track1.removeEventListener('ended', scheduleNextTrack)
      track2.removeEventListener('ended', scheduleNextTrack)
    }
  }, [])

  const playJumpSound = useCallback(() => {
    if (!audioElements.current.jump) {
      audioElements.current.jump = createAudio(audioSources.jump, 0.5)
    }
    audioElements.current.jump.currentTime = 0
    audioElements.current.jump?.play()
  }, [])

  const playDoubleJumpSound = useCallback(() => {
    if (!audioElements.current.doubleJump) {
      audioElements.current.doubleJump = createAudio(audioSources.doubleJump, 0.5)
    }
    audioElements.current.doubleJump.currentTime = 0
    audioElements.current.doubleJump?.play()
  }, [])

  const playLandingSound = useCallback(() => {
    if (!audioElements.current.landing) {
      audioElements.current.landing = createAudio(audioSources.landing, 0.4)
    }
    audioElements.current.landing.currentTime = 0
    audioElements.current.landing?.play()
  }, [])

  return {
    playBackgroundMusic,
    playJumpSound,
    playDoubleJumpSound,
    playLandingSound,
  }
} 