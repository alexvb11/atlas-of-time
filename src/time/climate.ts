// Global sea level and ice-sheet extent through the late Pleistocene.
// Sea level (m relative to today) is a rounded reading of the Spratt & Lisiecki (2016) stack for
// the last 450 kyr; before that it is a schematic glacial cycle (100 kyr after the Mid-Pleistocene
// Transition, smaller 41 kyr cycles before). All of it is labelled "estimated" in the UI.
import { PRESENT } from './scale'

const KA: [number, number][] = [
  [0, 0], [6, 0], [8, -14], [10, -42], [11.7, -60], [14, -85], [16, -108], [19, -122], [21, -125],
  [26, -122], [30, -88], [45, -74], [60, -82], [70, -60], [80, -28], [100, -36], [110, -44], [118, -10],
  [125, 5], [130, -20], [135, -95], [140, -120], [155, -105], [175, -90], [190, -70], [200, -30],
  [215, -15], [230, -50], [245, -15], [255, -90], [270, -100], [285, -70], [300, -45], [320, -10],
  [330, 2], [340, -90], [350, -110], [370, -60], [400, 5], [415, -20], [430, -120], [450, -95],
]

export function seaLevelAt(t: number): number {
  const k = (PRESENT - t) / 1000
  if (k <= 0) return 0
  if (k <= 450) {
    for (let i = 0; i < KA.length - 1; i++) {
      if (k <= KA[i + 1][0]) {
        const [k0, v0] = KA[i]
        const [k1, v1] = KA[i + 1]
        return v0 + ((v1 - v0) * (k - k0)) / (k1 - k0)
      }
    }
  }
  if (k <= 1000) return -55 + 55 * Math.cos(((k - 450) / 100) * Math.PI * 2 + Math.PI) // ~-110..0
  if (k <= 2600) return -30 + 30 * Math.cos(((k - 1000) / 41) * Math.PI * 2) // ~-60..0
  return 0
}

/** 0..1 scale of the Last Glacial Maximum ice-sheet mask */
export function iceAt(t: number): number {
  const s = seaLevelAt(t)
  return Math.min(1, Math.max(0, (-s - 20) / 100)) ** 1.1
}
