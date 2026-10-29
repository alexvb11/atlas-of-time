import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { availablePair, bracket, driftOk, loadDriftMesh, loadSnapshot, type DriftMesh } from '../data/drift'
import { driftFragment, driftVertex } from './shaders'
import { SUN, world } from './world'
import { useEarthTextures } from './Globe'
import { driftNow } from './selectionTrack'
import { useTime } from '../time/store'
import { vec3ToLonLat } from '../geo/sphere'
import { pointerOnGlobe } from './CameraRig'

const lineVertex = /* glsl */ `
attribute vec3 aPosA;
attribute vec3 aPosB;
attribute float aOkA;
attribute float aOkB;
uniform float uMix;
uniform float uLift;
uniform vec3 uSun;
varying float vFacing;
varying float vOk;
void main() {
  vec3 p = normalize(mix(aPosA, aPosB, uMix));
  vOk = mix(aOkA, aOkB, uMix) * (0.2 + 0.8 * smoothstep(-0.2, 0.3, dot(p, uSun)));
  vec4 w = modelMatrix * vec4(p * uLift, 1.0);
  vFacing = dot(normalize(cameraPosition - w.xyz), p);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`
const lineFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFacing;
varying float vOk;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.0, 0.25, vFacing) * vOk * vOk);
}
`

export function DriftLand() {
  const [mesh, setMesh] = useState<DriftMesh | null>(null)
  useEffect(() => {
    loadDriftMesh().then((m) => {
      driftNow.mesh = m
      setMesh(m)
      // warm the most visited snapshots
      for (const t of [0, 5, 100, 200, 250]) loadSnapshot(t)
    })
  }, [])
  if (!mesh) return null
  return <DriftLayers mesh={mesh} />
}

function DriftLayers({ mesh }: { mesh: DriftMesh }) {
  const tex = useEarthTextures()
  const group = useRef<THREE.Group>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const coastMat = useRef<THREE.ShaderMaterial>(null)
  const borderMat = useRef<THREE.ShaderMaterial>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const { land, coast, borders, attrA, attrB } = useMemo(() => {
    const attrA = new THREE.BufferAttribute(new Float32Array(mesh.present), 3)
    const attrB = new THREE.BufferAttribute(new Float32Array(mesh.present), 3)
    attrA.setUsage(THREE.DynamicDrawUsage)
    attrB.setUsage(THREE.DynamicDrawUsage)
    const uv = new Float32Array(mesh.n * 2)
    for (let i = 0; i < mesh.n; i++) {
      uv[i * 2] = (mesh.lonlat[i * 2] + 180) / 360
      uv[i * 2 + 1] = (mesh.lonlat[i * 2 + 1] + 90) / 180
    }
    const pos = new THREE.BufferAttribute(new Float32Array(mesh.present), 3)
    const mk = (index: Uint32Array) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', pos)
      g.setAttribute('aPosA', attrA)
      g.setAttribute('aPosB', attrB)
      g.setAttribute('aOkA', new THREE.BufferAttribute(new Float32Array(mesh.n).fill(1), 1))
      g.setAttribute('aOkB', new THREE.BufferAttribute(new Float32Array(mesh.n).fill(1), 1))
      g.setIndex(new THREE.BufferAttribute(index, 1))
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.01)
      return g
    }
    const land = mk(mesh.tris)
    land.setAttribute('aUv', new THREE.BufferAttribute(uv, 2))
    return { land, coast: mk(mesh.coast), borders: mk(mesh.borders), attrA, attrB }
  }, [mesh])

  const uniforms = useMemo(
    () => ({
      uDay: { value: tex.day },
      uData: { value: tex.data },
      uSun: { value: SUN },
      uMix: { value: 0 },
      uLift: { value: 1.0015 },
      uOpacity: { value: 0 },
      uDim: { value: 0 },
      uLights: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uTintAmt: { value: 0 },
      uSnow: { value: 0 },
    }),
    [tex],
  )
  const coastUniforms = useMemo(
    () => ({ uMix: { value: 0 }, uSun: { value: SUN }, uLift: { value: 1.0022 }, uColor: { value: new THREE.Color('#a8e6ff') }, uOpacity: { value: 0 } }),
    [],
  )
  const borderUniforms = useMemo(
    () => ({ uMix: { value: 0 }, uSun: { value: SUN }, uLift: { value: 1.0024 }, uColor: { value: new THREE.Color('#ffc477') }, uOpacity: { value: 0 } }),
    [],
  )

  const current = useRef<{ A: Float32Array | null; B: Float32Array | null }>({ A: null, B: null })
  const cpuDirty = useRef(true)
  const lastMa = useRef(-1)

  useFrame(() => {
    const visible = world.drift > 0.002
    if (group.current) group.current.visible = visible
    if (!visible) return
    const ma = world.ma

    // stream the bracketing snapshots plus the next pair in the direction of travel
    const { a, b } = bracket(mesh.times, ma)
    const dir = ma >= lastMa.current ? 1 : -1
    lastMa.current = ma
    const ia = mesh.times.indexOf(a)
    for (const k of [ia, ia + 1, ia + 1 + dir, ia + 2 * dir]) {
      const t = mesh.times[k]
      if (t !== undefined) loadSnapshot(t)
    }
    void b

    const pair = availablePair(mesh, ma)
    if (!pair) return
    const setOk = (which: 'aOkA' | 'aOkB', snap: Float32Array) => {
      const ok = driftOk.get(snap)!
      for (const [g, key] of [[land, 'tris'], [coast, 'coast'], [borders, 'borders']] as const) {
        const attr = g.attributes[which] as THREE.BufferAttribute
        ;(attr.array as Float32Array).set(ok[key])
        attr.needsUpdate = true
      }
    }
    if (pair.A !== current.current.A) {
      setOk('aOkA', pair.A)
      ;(attrA.array as Float32Array).set(pair.A)
      attrA.needsUpdate = true
      current.current.A = pair.A
      cpuDirty.current = true
    }
    if (pair.B !== current.current.B) {
      setOk('aOkB', pair.B)
      ;(attrB.array as Float32Array).set(pair.B)
      attrB.needsUpdate = true
      current.current.B = pair.B
      cpuDirty.current = true
    }
    if (pair.f !== driftNow.f) cpuDirty.current = true
    driftNow.A = pair.A
    driftNow.B = pair.B
    driftNow.f = pair.f

    const u = matRef.current?.uniforms
    if (u) {
      u.uMix.value = pair.f
      u.uOpacity.value = Math.min(1, world.drift * 1.15) * world.deepConf
      u.uDim.value = world.dim * 0.3
      u.uTint.value.copy(world.tint)
      u.uTintAmt.value = world.tintAmt
      u.uSnow.value = world.snow
      matRef.current!.depthWrite = world.drift > 0.5
    }
    for (const [m, op] of [
      [coastMat.current, 0.28],
      [borderMat.current, 0.2],
    ] as const) {
      if (!m) continue
      m.uniforms.uMix.value = pair.f
      m.uniforms.uOpacity.value = op * world.drift
    }
  })

  // CPU copy of the interpolated positions, only refreshed when a raycast needs it
  const syncCpu = () => {
    if (!cpuDirty.current) return
    const A = current.current.A
    const B = current.current.B
    if (!A || !B) return
    const f = driftNow.f
    const p = land.attributes.position.array as Float32Array
    for (let i = 0; i < mesh.n; i++) {
      const x = A[i * 3] + (B[i * 3] - A[i * 3]) * f
      const y = A[i * 3 + 1] + (B[i * 3 + 1] - A[i * 3 + 1]) * f
      const z = A[i * 3 + 2] + (B[i * 3 + 2] - A[i * 3 + 2]) * f
      const l = 1.0015 / Math.hypot(x, y, z)
      p[i * 3] = x * l
      p[i * 3 + 1] = y * l
      p[i * 3 + 2] = z * l
    }
    land.attributes.position.needsUpdate = true
    cpuDirty.current = false
  }
  useEffect(() => {
    const m = meshRef.current
    if (!m) return
    const base = THREE.Mesh.prototype.raycast
    m.raycast = function (raycaster, hits) {
      if (world.drift < 0.5) return
      syncCpu()
      base.call(this, raycaster, hits)
    }
  })

  const presentOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!e.face) return null
    const pos = land.attributes.position as THREE.BufferAttribute
    const tri = new THREE.Triangle(
      new THREE.Vector3().fromBufferAttribute(pos, e.face.a),
      new THREE.Vector3().fromBufferAttribute(pos, e.face.b),
      new THREE.Vector3().fromBufferAttribute(pos, e.face.c),
    )
    const bc = tri.getBarycoord(e.point, new THREE.Vector3())
    if (!bc) return null
    const v = new THREE.Vector3()
    const P = mesh.present
    v.x = P[e.face.a * 3] * bc.x + P[e.face.b * 3] * bc.y + P[e.face.c * 3] * bc.z
    v.y = P[e.face.a * 3 + 1] * bc.x + P[e.face.b * 3 + 1] * bc.y + P[e.face.c * 3 + 1] * bc.z
    v.z = P[e.face.a * 3 + 2] * bc.x + P[e.face.b * 3 + 2] * bc.y + P[e.face.c * 3 + 2] * bc.z
    return vec3ToLonLat(v)
  }

  const down = useRef<[number, number] | null>(null)
  return (
    <group ref={group} visible={false}>
      <mesh
        ref={meshRef}
        geometry={land}
        renderOrder={1}
        onPointerMove={(e) => {
          e.stopPropagation()
          if (pointerOnGlobe.dragging) return
          const p = presentOf(e)
          if (p) useTime.getState().setHover({ lonlat: p, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
        }}
        onPointerDown={(e) => (down.current = [e.nativeEvent.clientX, e.nativeEvent.clientY])}
        onClick={(e) => {
          e.stopPropagation()
          const d = down.current
          if (d && Math.hypot(e.nativeEvent.clientX - d[0], e.nativeEvent.clientY - d[1]) > 6) return
          const p = presentOf(e)
          if (p) useTime.getState().select(p)
        }}
      >
        <shaderMaterial ref={matRef} vertexShader={driftVertex} fragmentShader={driftFragment} uniforms={uniforms} transparent />
      </mesh>
      <lineSegments geometry={coast} renderOrder={2} raycast={() => null}>
        <shaderMaterial ref={coastMat} vertexShader={lineVertex} fragmentShader={lineFragment} uniforms={coastUniforms} transparent depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={borders} renderOrder={2} raycast={() => null}>
        <shaderMaterial ref={borderMat} vertexShader={lineVertex} fragmentShader={lineFragment} uniforms={borderUniforms} transparent depthWrite={false} />
      </lineSegments>
    </group>
  )
}
