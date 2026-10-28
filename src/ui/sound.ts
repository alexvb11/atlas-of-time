// Understated procedural audio (Web Audio, no files). Off by default.
type Nodes = { ctx: AudioContext; master: GainNode; drone: GainNode; droneOsc: OscillatorNode[]; warpOsc: OscillatorNode; warpGain: GainNode }
let n: Nodes | null = null
let enabled = false

function init(): Nodes {
  if (n) return n
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  // drone: two low detuned sines through a slowly breathing lowpass
  const drone = ctx.createGain()
  drone.gain.value = 0.16
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 320
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.05
  lfoGain.gain.value = 140
  lfo.connect(lfoGain).connect(lp.frequency)
  lfo.start()
  const droneOsc = [55, 82.4, 110.3].map((f, i) => {
    const o = ctx.createOscillator()
    o.type = i === 2 ? 'triangle' : 'sine'
    o.frequency.value = f
    o.detune.value = (i - 1) * 6
    const g = ctx.createGain()
    g.gain.value = i === 2 ? 0.18 : 0.5
    o.connect(g).connect(lp)
    o.start()
    return o
  })
  lp.connect(drone).connect(master)

  // warp: a faint rising tone tied to scrub velocity
  const warpOsc = ctx.createOscillator()
  warpOsc.type = 'sine'
  warpOsc.frequency.value = 180
  const warpGain = ctx.createGain()
  warpGain.gain.value = 0
  warpOsc.connect(warpGain).connect(master)
  warpOsc.start()

  n = { ctx, master, drone, droneOsc, warpOsc, warpGain }
  return n
}

function noiseBurst(dur: number, from: number, to: number, gain: number) {
  if (!enabled || !n) return
  const { ctx, master } = n
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  const t = ctx.currentTime
  bp.frequency.setValueAtTime(from, t)
  bp.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp).connect(g).connect(master)
  src.start()
}

export const sound = {
  setEnabled(on: boolean) {
    enabled = on
    const s = init()
    if (s.ctx.state === 'suspended') s.ctx.resume()
    const t = s.ctx.currentTime
    s.master.gain.cancelScheduledValues(t)
    s.master.gain.setTargetAtTime(on ? 0.5 : 0, t, 0.6)
  },
  whoosh() {
    noiseBurst(1.6, 300, 1800, 0.22)
  },
  tick() {
    if (!enabled || !n) return
    const { ctx, master } = n
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 1320
    const t = ctx.currentTime
    g.gain.setValueAtTime(0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.1)
  },
  warp(v: number) {
    if (!enabled || !n) return
    const t = n.ctx.currentTime
    n.warpGain.gain.setTargetAtTime(Math.min(0.05, v * 0.05), t, 0.15)
    n.warpOsc.frequency.setTargetAtTime(160 + v * 420, t, 0.2)
  },
}
