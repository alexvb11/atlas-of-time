// Settings that act outside the 3D scene: label size (a CSS variable), reduced motion, tour
// narration and the playback speed. Applied once at start and again whenever they change.
import { useSettings, type Settings } from '../time/settings'
import { useTime } from '../time/store'
import { useTourStore } from '../ui/explore/tourStore'

const LABEL_SCALE: Record<Settings['labelSize'], string> = { small: '0.85', medium: '1', large: '1.25' }
const systemReduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function apply(s: Settings, prev?: Settings) {
  document.documentElement.style.setProperty('--label-scale', LABEL_SCALE[s.labelSize])
  useTime.getState().set({ reducedMotion: s.motion === 'system' ? systemReduced() : s.motion === 'reduced' })
  if (!prev || prev.narrate !== s.narrate) useTourStore.getState().set({ narrate: s.narrate })
  if (!prev || prev.defaultSpeed !== s.defaultSpeed) useTime.getState().setSpeed(s.defaultSpeed)
}

apply(useSettings.getState())
useSettings.subscribe((s, prev) => apply(s, prev))
