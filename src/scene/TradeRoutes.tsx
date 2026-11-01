// Trade routes in use at the current date, as lines with dashes flowing in the direction of travel,
// and a small label (click it to read about the route). See src/data/trade.ts for the sources.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { TRADE_ROUTES, routeAlpha, type TradeRoute } from '../data/trade'
import { settings } from '../time/settings'
import { useReader } from '../ui/wiki/store'
import { world } from './world'

const COLORS: Record<TradeRoute['kind'], string> = { land: '#ffc477', sea: '#7fd8ff', river: '#9be7c4' }
const colorOf = (r: TradeRoute) => (r.id === 'atlantic-slave-trade' ? '#e09a8f' : COLORS[r.kind])

const vert = /* glsl */ `
attribute float aDist;
varying float vDist;
varying float vFacing;
void main() {
  vDist = aDist;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), normalize(position));
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vDist;
varying float vFacing;
void main() {
  // caravans: bright dashes moving along the route over a faint base line
  float d = fract(vDist * 60.0 - uTime * 0.35);
  float dash = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(0.3, 0.45, d));
  float a = (0.28 + 0.72 * dash) * uOpacity * smoothstep(0.02, 0.25, vFacing);
  gl_FragColor = vec4(uColor, a);
}
`

/** Great-circle points along a polyline, with the distance travelled at each */
function densify(line: [number, number][]) {
  const pts: number[] = []
  const dist: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const p = new THREE.Vector3()
  let run = 0
  let prev: THREE.Vector3 | null = null
  for (let i = 0; i < line.length - 1; i++) {
    lonLatToVec3(line[i][0], line[i][1], 1, a)
    lonLatToVec3(line[i + 1][0], line[i + 1][1], 1, b)
    const ang = a.angleTo(b)
    const n = Math.max(2, Math.ceil(((ang * 180) / Math.PI) / 0.8))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      p.copy(a).lerp(b, k / n).normalize()
      if (prev) run += prev.distanceTo(p)
      prev = (prev ?? new THREE.Vector3()).copy(p)
      pts.push(p.x * 1.0035, p.y * 1.0035, p.z * 1.0035)
      dist.push(run)
    }
  }
  return { pts: new Float32Array(pts), dist: new Float32Array(dist) }
}

function Route({ r }: { r: TradeRoute }) {
  const { camera, size } = useThree()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uColor: { value: new THREE.Color(colorOf(r)) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [r],
  )
  const lines = useMemo(
    () =>
      r.lines.map((l) => {
        const { pts, dist } = densify(l)
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pts, 3))
        g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1))
        const line = new THREE.Line(g, mat)
        line.renderOrder = 8
        line.raycast = () => {}
        return line
      }),
    [r, mat],
  )
  useEffect(
    () => () => {
      lines.forEach((l) => l.geometry.dispose())
      mat.dispose()
    },
    [lines, mat],
  )

  // label at the middle of the first line
  const anchor = useMemo(() => {
    const l = r.lines[0]
    const m = l[Math.floor(l.length / 2)]
    return lonLatToVec3(m[0], m[1], 1.005)
  }, [r])
  const label = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'route-label'
    el.style.setProperty('--c', colorOf(r))
    el.textContent = r.name
    el.title = `${r.goods}. Click to read about it.`
    el.setAttribute('aria-label', `${r.name}: ${r.goods}`)
    el.onclick = () => useReader.getState().open(r.article)
    host.appendChild(el)
    label.current = el
    return () => el.remove()
  }, [r])

  const v = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const on = settings().trade && world.drift < 0.02 ? 1 : 0
    const a = routeAlpha(r, world.t) * on * (1 - world.dim * 0.6)
    mat.uniforms.uOpacity.value += (a * 0.85 - mat.uniforms.uOpacity.value) * 0.12
    mat.uniforms.uTime.value = state.clock.elapsedTime
    lines.forEach((l) => (l.visible = mat.uniforms.uOpacity.value > 0.005))
    const el = label.current
    if (!el) return
    camDir.copy(camera.position).normalize()
    const facing = anchor.dot(camDir) / 1.005
    const la = a * THREE.MathUtils.smoothstep(facing, 0.35, 0.65)
    el.style.opacity = la.toFixed(2)
    el.style.pointerEvents = la > 0.3 ? 'auto' : 'none'
    // hidden labels leave the tab order and the accessibility tree
    el.style.visibility = la < 0.02 ? 'hidden' : 'visible'
    if (la < 0.02) return
    v.copy(anchor).project(camera)
    el.style.transform = `translate(-50%, -50%) translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
  })
  return (
    <>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </>
  )
}

export function TradeRoutesLayer() {
  return (
    <>
      {TRADE_ROUTES.map((r) => (
        <Route key={r.id} r={r} />
      ))}
    </>
  )
}
