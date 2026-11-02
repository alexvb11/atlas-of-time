// Understated procedural audio (Web Audio, no files). Off by default.
// Era soundscapes crossfade with the date: rumbles in deep time, gusting wind in the ice ages,
// fire by night in the Stone Age, a drone with plucked strings in antiquity, distant bells in the
// Middle Ages, a machine pulse in the industrial age, an electric hum today. All synthesized, so
// impressions of an age rather than recordings of it.
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


// ---------- era soundscapes ----------
type Layer = { gain: GainNode; level: number }
let layers: Record<string, Layer> | null = null
let noiseBuf: AudioBuffer | null = null
const noise = (ctx: AudioContext) => {
  if (noiseBuf) return noiseBuf
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const d = noiseBuf.getChannelData(0)
  let b = 0
  // brownish noise: softer than white
  for (let i = 0; i < d.length; i++) {
    b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = b * 3.5
  }
  return noiseBuf
}
function loopNoise(ctx: AudioContext, out: AudioNode, type: BiquadFilterType, freq: number, q: number, lfoHz: number, lfoDepth: number) {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.value = 0.5
  if (lfoHz > 0) {
    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.frequency.value = lfoHz
    lg.gain.value = lfoDepth
    lfo.connect(lg).connect(g.gain)
    lfo.start()
  }
  src.connect(f).connect(g).connect(out)
  src.start()
}
function initLayers(s: Nodes) {
  if (layers) return layers
  const { ctx, master } = s
  const mk = () => {
    const g = ctx.createGain()
    g.gain.value = 0
    g.connect(master)
    return { gain: g, level: 0 }
  }
  layers = { rumble: mk(), wind: mk(), fire: mk(), lyre: mk(), bells: mk(), machine: mk(), hum: mk() }
  loopNoise(ctx, layers.rumble.gain, 'lowpass', 70, 0.7, 0.07, 0.35)
  loopNoise(ctx, layers.wind.gain, 'bandpass', 700, 0.8, 0.13, 0.4)
  loopNoise(ctx, layers.fire.gain, 'lowpass', 400, 0.5, 0, 0)
  loopNoise(ctx, layers.machine.gain, 'lowpass', 180, 1.2, 1.7, 0.5)
  // mains-like hum, softened
  const hum = ctx.createOscillator()
  hum.type = 'sawtooth'
  hum.frequency.value = 55
  const hf = ctx.createBiquadFilter()
  hf.type = 'lowpass'
  hf.frequency.value = 240
  const hg = ctx.createGain()
  hg.gain.value = 0.12
  hum.connect(hf).connect(hg).connect(layers.hum.gain)
  hum.start()
  return layers
}

/** layer weights 0..1 for a date (astronomical year) */
function eraMix(t: number): Record<string, number> {
  const ya = 2026 - t
  const band = (x: number, a: number, b: number, c: number, d: number) =>
    Math.max(0, Math.min(1, (x - a) / Math.max(1e-9, b - a), (d - x) / Math.max(1e-9, d - c)))
  return {
    rumble: ya > 2.6e6 ? 1 : 0,
    wind: ya > 11700 && ya <= 2.6e6 ? 1 : 0,
    fire: band(t, -300000, -100000, -4000, -2800),
    lyre: band(t, -3200, -2800, 450, 550),
    bells: band(t, 450, 550, 1450, 1550),
    machine: band(t, 1760, 1830, 1940, 1970),
    hum: band(t, 1900, 1960, 3000, 3001),
  }
}

let lastPluck = 0
function pluck(s: Nodes, freq: number, gain: number, decay: number, inharmonic = false) {
  const { ctx } = s
  const t = ctx.currentTime
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  g.connect(s.master)
  // a few partials: harmonic for a string, stretched for a bell
  for (const [k, a] of [[1, 1], [2, 0.4], [3, 0.2], [4.2, 0.15]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * (inharmonic ? k * (1 + 0.06 * (k - 1)) : Math.round(k))
    const pg = ctx.createGain()
    pg.gain.value = a
    o.connect(pg).connect(g)
    o.start(t)
    o.stop(t + decay)
  }
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
  /** crossfade the era layers toward the date; called every frame */
  era(t: number) {
    if (!enabled || !n) return
    const L = initLayers(n)
    const mix = eraMix(t)
    const now = n.ctx.currentTime
    for (const [k, layer] of Object.entries(L)) {
      const want = (mix[k] ?? 0) * (k === 'hum' ? 0.5 : k === 'rumble' ? 0.9 : 0.6)
      if (Math.abs(want - layer.level) > 0.01) {
        layer.level = want
        layer.gain.gain.setTargetAtTime(want, now, 1.2)
      }
    }
    // occasional notes: a pentatonic lyre in antiquity, a low bell in the Middle Ages, crackles by the fire
    const wait = 2.5 + Math.random() * 3
    if (now - lastPluck > wait) {
      lastPluck = now
      if (mix.lyre > 0.3) pluck(n, [196, 220, 261.6, 293.7, 329.6][Math.floor(Math.random() * 5)], 0.05 * mix.lyre, 2.2)
      else if (mix.bells > 0.3 && Math.random() < 0.5) pluck(n, 130.8, 0.06 * mix.bells, 5, true)
      else if (mix.fire > 0.3) for (let i = 0; i < 4; i++) setTimeout(() => noiseBurst(0.05, 1800, 3000, 0.05 * mix.fire), Math.random() * 1500)
    }
  },
  warp(v: number) {
    if (!enabled || !n) return
    const t = n.ctx.currentTime
    n.warpGain.gain.setTargetAtTime(Math.min(0.05, v * 0.05), t, 0.15)
    n.warpOsc.frequency.setTargetAtTime(160 + v * 420, t, 0.2)
  },
}
