// The real sky around the globe, for the last 30,000 years or so:
//   - the 9,096 stars of the Yale Bright Star Catalogue, sized by brightness and coloured by
//     temperature, carried to the date by precession and their own motions (src/time/astro.ts);
//   - the Milky Way haze turned to the real galactic plane and centre;
//   - the Moon in its place for the date (so its phase is right), lit by the Sun;
//   - the Sun itself, a small disk with a glow, in the scene's sun direction.
// The sky turns with the time of day the scene's Sun implies: the sidereal angle is the Sun's right
// ascension minus the longitude where it stands overhead. Before about 30,000 years ago the stars'
// places cannot be extrapolated honestly, so the generic starfield returns (Space.tsx).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3, vec3ToLonLat } from '../geo/sphere'
import { moonPlace, starAt, sunRA } from '../time/astro'
import { PRESENT, yearsAgo } from '../time/scale'
import { settings } from '../time/settings'
import { starFragment, starVertex } from './Space'

// The stars keep their J2000 places on the GPU; the vertex shader moves them to the date: each
// star's own motion (aPM, per year) and then precession, a turn about the ecliptic pole (uPrec).
const skyVertex = starVertex
  .replace('uniform float uWarp;', 'uniform float uWarp;\nuniform mat3 uPrec;\nuniform float uYears;\nuniform float uR;\nattribute vec3 aPM;')
  .replace('vec4 mv = modelViewMatrix * vec4(position, 1.0);', 'vec3 sp = uPrec * (normalize(position + aPM * uYears) * uR);\n  vec4 mv = modelViewMatrix * vec4(sp, 1.0);')
import { SUN, world } from './world'

type Star = [number, number, number, number, number, number]
const R_SKY = 95
const GAL_POLE: [number, number] = [192.85948, 27.12825]
const GAL_CORE: [number, number] = [266.40499, -28.93617]

/** Star colour from B−V: temperature (Ballesteros 2012), then an approximate blackbody tint */
function bvColor(bv: number, c: THREE.Color) {
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
  const t = T / 100
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332)
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305
  const k = (x: number) => Math.min(1, Math.max(0, x / 255))
  // pale it toward white, as stars look to the eye
  return c.setRGB(0.55 + 0.45 * k(r), 0.55 + 0.45 * k(g), 0.55 + 0.45 * k(b))
}

/** Sidereal angle (degrees) implied by the scene: where the Sun is overhead now, and its RA for the date */
function siderealAngle(t: number) {
  const live = t >= PRESENT - 0.002
  const when = live ? 2000 + (Date.now() - Date.UTC(2000, 0, 1)) / (365.2425 * 864e5) : t
  const [sunLon] = vec3ToLonLat(SUN.clone())
  return { theta: sunRA(when) - sunLon, when }
}

export function Sky() {
  const [stars, setStars] = useState<Star[] | null>(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/stars.json`)
      .then((r) => r.json())
      .then((j) => setStars(j.stars), () => {})
  }, [])

  const group = useRef<THREE.Group>(null)
  const geo = useMemo(() => {
    if (!stars) return null
    const n = stars.length
    const g = new THREE.BufferGeometry()
    // positions for today; useFrame moves them when the date changes
    const pos = new Float32Array(n * 3)
    const pm = new Float32Array(n * 3)
    const v = new THREE.Vector3()
    const east = new THREE.Vector3()
    const north = new THREE.Vector3()
    const AS = Math.PI / 180 / 3600
    stars.forEach(([ra, dec, , , pmra, pmde], i) => {
      lonLatToVec3(ra, dec, 1, v)
      pos.set([v.x, v.y, v.z], i * 3)
      // unit vectors toward increasing RA and Dec; motion in radians a year along them
      lonLatToVec3(ra + 90, 0, 1, east)
      north.crossVectors(v, east)
      pm.set([(east.x * pmra + north.x * pmde) * AS, (east.y * pmra + north.y * pmde) * AS, (east.z * pmra + north.z * pmde) * AS], i * 3)
    })
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPM', new THREE.BufferAttribute(pm, 3))
    const col = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const phase = new Float32Array(n)
    const c = new THREE.Color()
    stars.forEach(([, , v, bv], i) => {
      // brightness: the eye's response to magnitude, compressed so faint stars stay visible
      const bright = Math.min(1.8, 0.38 + 1.1 * Math.pow(10, -0.4 * (v - 2)))
      bvColor(bv, c)
      col.set([c.r * bright, c.g * bright, c.b * bright], i * 3)
      size[i] = Math.min(7, Math.max(1.5, 5.2 - 0.62 * v))
      phase[i] = (i * 0.618) % 1
    })
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [stars])
  const starUniforms = useMemo(
    () => ({
      uWarp: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio) },
      uOpacity: { value: 0 },
      uPrec: { value: new THREE.Matrix3() },
      uYears: { value: 0 },
      uR: { value: R_SKY },
    }),
    [],
  )

  // the Moon
  const moonTex = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}textures/moon.webp`)
  const moon = useRef<THREE.Mesh>(null)
  const moonMat = useMemo(() => {
    moonTex.colorSpace = THREE.SRGBColorSpace
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: moonTex }, uSun: { value: SUN }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vN;
        void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uSun; uniform float uOpacity; varying vec2 vUv; varying vec3 vN;
        void main() {
          float l = max(dot(normalize(vN), uSun), 0.0);
          vec3 c = texture2D(uMap, vUv).rgb * (0.015 + 1.35 * pow(l, 0.85));
          gl_FragColor = vec4(c, uOpacity);
          #include <colorspace_fragment>
        }`,
      transparent: true,
    })
  }, [moonTex])

  // the Sun: a disk of its true angular size and a soft glow
  const sun = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(256, 256)
    // a disk of the Sun's real size, then glare that falls off smoothly (no visible edge)
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const r = Math.hypot(x - 127.5, y - 127.5) / 128
        const core = 1 - THREE.MathUtils.smoothstep(r, 0.035, 0.05)
        const glare = (0.5 * Math.exp(-r / 0.045) + 0.12 * Math.exp(-r / 0.16)) * (1 - r) ** 2
        const a = Math.min(1, core + glare)
        const i = (y * 256 + x) * 4
        img.data.set([255, 246 - 30 * (1 - core) * r, 228 - 80 * (1 - core) * r, Math.round(255 * Math.max(0, a))], i)
      }
    ctx.putImageData(img, 0, 0)
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    // the bright core is the Sun's real size (0.53°) at 180 units; the rest is glare
    s.scale.setScalar(33)
    s.renderOrder = -5
    return s
  }, [])

  const lastT = useRef(NaN)
  const precM = useMemo(() => new THREE.Matrix4(), [])
  // the ecliptic north pole in the J2000 equatorial frame (RA 270°, Dec 66.56°)
  const eclPole = useMemo(() => lonLatToVec3(270, 90 - 23.4392911, 1), [])
  useFrame((state) => {
    const t = world.t
    const prefs = settings()
    // the real sky from today back to ~10,000 years, fading out by 30,000
    const ya = yearsAgo(t)
    const real = (1 - THREE.MathUtils.smoothstep(ya, 10000, 30000)) * (prefs.stars ? 1 : 0)
    world.realSky = prefs.stars ? 1 - THREE.MathUtils.smoothstep(ya, 10000, 30000) : 0
    const { theta, when } = siderealAngle(t)
    if (group.current) group.current.rotation.y = -theta * THREE.MathUtils.DEG2RAD

    // precession since J2000: a turn about the ecliptic pole of 50.29" a year
    const years = when - 2000
    if (!(Math.abs(when - lastT.current) < 0.5)) {
      lastT.current = when
      precM.makeRotationAxis(eclPole, years * (50.29 / 3600) * THREE.MathUtils.DEG2RAD)
      starUniforms.uPrec.value.setFromMatrix4(precM)
      starUniforms.uYears.value = years
    }
    // the Milky Way follows the galactic plane, precessed like the stars
    for (const [target, [ra, dec]] of [[world.galPole, GAL_POLE], [world.galCore, GAL_CORE]] as const) {
      const [r, d] = starAt(ra, dec, 0, 0, when)
      lonLatToVec3(r - theta, d, 1, target)
    }
    starUniforms.uOpacity.value = real
    starUniforms.uWarp.value = world.warp
    starUniforms.uTime.value = state.clock.elapsedTime

    // Moon: shown where the simple lunar theory holds (the last ~5,000 years)
    const m = moon.current
    if (m) {
      const showMoon = prefs.moonSun && t > -2999 && world.drift < 0.02
      m.visible = showMoon
      if (showMoon) {
        const mp = moonPlace(when)
        lonLatToVec3(mp.ra - theta, mp.dec, mp.dist, m.position)
        m.lookAt(0, 0, 0)
        m.rotateY(-Math.PI / 2)
      }
    }
    sun.visible = prefs.moonSun
    sun.position.copy(SUN).multiplyScalar(180)
  })

  return (
    <>
      <group ref={group}>
        {geo && (
          <points geometry={geo} raycast={() => null} frustumCulled={false}>
            <shaderMaterial vertexShader={skyVertex} fragmentShader={starFragment} uniforms={starUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </points>
        )}
      </group>
      <mesh ref={moon} material={moonMat} raycast={() => null}>
        <sphereGeometry args={[0.2727, 64, 32]} />
      </mesh>
      <primitive object={sun} />
    </>
  )
}
