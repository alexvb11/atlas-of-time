// The sky as seen standing on the ground: a dome around the viewer coloured by the sun's height
// (blue noon, warm dusk, dark night with the stars showing through), with the sun's disk and glare
// and a slow drift of procedural clouds. The globe's atmosphere shell is made for looking in from
// space and washes out from inside, so it steps aside while this is up (Globe.tsx).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from './CameraRig'
import { SUN } from './world'
import { settings } from '../time/settings'

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const frag = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uUp;
uniform vec3 uEast;
uniform vec3 uNorth;
uniform float uOpacity;
uniform float uTime;
uniform float uClouds;
varying vec3 vDir;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float se = dot(uSun, uUp);          // sun height: 1 overhead, 0 on the horizon
  float ve = dot(d, uUp);             // view height
  float mu = dot(d, uSun);
  float day = smoothstep(-0.14, 0.10, se);
  float dusk = exp(-abs(se) / 0.09);  // strong while the sun is near the horizon
  // day sky: deep blue overhead, pale at the horizon
  float h = clamp(ve, 0.0, 1.0);
  vec3 zen = vec3(0.12, 0.31, 0.78);
  vec3 hor = vec3(0.66, 0.77, 0.90);
  vec3 sky = mix(hor, zen, pow(h, 0.55));
  // dusk: the horizon warms toward the sun and purples away from it
  float toward = 0.5 + 0.5 * mu;
  vec3 warm = mix(vec3(0.55, 0.35, 0.55), vec3(1.0, 0.56, 0.22), toward);
  sky = mix(sky, warm, dusk * (1.0 - h) * (1.0 - h) * 0.9);
  sky = mix(sky, sky * vec3(1.0, 0.72, 0.5), dusk * 0.35);
  // glare around the sun, wider near the horizon
  float g = 0.5 * pow(max(mu, 0.0), 400.0) + 0.16 * pow(max(mu, 0.0), 40.0) + 0.05 * pow(max(mu, 0.0), 6.0) * (1.0 - h);
  sky += vec3(1.0, 0.92, 0.78) * g;
  // the disk itself: half a degree across, bright enough to bloom
  float disk = smoothstep(0.999985, 0.999994, mu);
  sky += vec3(4.0, 3.7, 3.1) * disk;
  // night: a faint deep blue with airglow at the horizon
  vec3 night = vec3(0.012, 0.018, 0.045) + vec3(0.02, 0.03, 0.05) * pow(1.0 - h, 6.0);
  vec3 col = mix(night, sky, day);

  // clouds: a layer about 2 km up, drifting east; thinner and lower toward the horizon
  if (ve > 0.015 && uClouds > 0.001) {
    vec2 hp = vec2(dot(d, uEast), dot(d, uNorth)) / max(ve, 0.015);
    vec2 p = hp * 1.9 + vec2(uTime * 0.004, uTime * 0.0013);
    float n = fbm(p);
    float cover = smoothstep(0.52, 0.72, n) * uClouds;
    float horizonFade = 1.0 - exp(-ve * 9.0);
    cover *= horizonFade;
    // lit from above, shaded underneath, warm at dusk, dark at night
    float lit = 0.62 + 0.5 * smoothstep(0.52, 0.85, n);
    vec3 cloudCol = mix(vec3(0.72, 0.76, 0.84), vec3(1.0), lit - 0.5) * (0.35 + 0.65 * day);
    cloudCol = mix(cloudCol, cloudCol * vec3(1.0, 0.68, 0.45), dusk * 0.7);
    cloudCol += vec3(1.0, 0.9, 0.7) * pow(max(mu, 0.0), 8.0) * 0.25 * day;
    col = mix(col, cloudCol, cover * 0.92);
  }
  // below the horizon (where no ground is drawn, over the sea): dark water-coloured ground
  if (ve < 0.0) col = mix(vec3(0.05, 0.07, 0.09) * (0.2 + 0.8 * day), col, exp(ve * 40.0));
  float a = mix(0.3, 1.0, day) * uOpacity;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const tmpUp = new THREE.Vector3()
/** The sky's colour at the horizon for the current sun, as the dome draws it (for haze and reflections) */
export function horizonColour(camPos: THREE.Vector3, out: THREE.Color) {
  const up = tmpUp.copy(camPos).normalize()
  const se = SUN.dot(up)
  const day = THREE.MathUtils.smoothstep(se, -0.14, 0.1)
  const dusk = Math.exp(-Math.abs(se) / 0.09)
  // the horizon blue, warmed at dusk (averaged over the compass), fading to the night tint
  let r = 0.66, g = 0.77, b = 0.9
  r += (0.78 - r) * dusk * 0.9
  g += (0.46 - g) * dusk * 0.9
  b += (0.38 - b) * dusk * 0.9
  out.setRGB(0.03 + (r - 0.03) * day, 0.035 + (g - 0.035) * day, 0.06 + (b - 0.06) * day)
}

export function GroundSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uSun: { value: SUN },
          uUp: { value: new THREE.Vector3(0, 1, 0) },
          uEast: { value: new THREE.Vector3(1, 0, 0) },
          uNorth: { value: new THREE.Vector3(0, 0, 1) },
          uOpacity: { value: 0 },
          uTime: { value: 0 },
          uClouds: { value: 1 },
        },
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  // 380 km across: beyond any hill that still shows through the haze
  const geo = useMemo(() => new THREE.SphereGeometry(0.06, 48, 32), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  const mesh = useRef<THREE.Mesh>(null)
  useFrame(({ camera, clock }) => {
    const want = rig.groundBlend
    const u = mat.uniforms
    u.uOpacity.value += (want - u.uOpacity.value) * 0.2
    const up = (u.uUp.value as THREE.Vector3).copy(camera.position).normalize()
    const east = (u.uEast.value as THREE.Vector3).set(0, 1, 0).cross(up).normalize()
    ;(u.uNorth.value as THREE.Vector3).crossVectors(up, east).normalize()
    u.uTime.value = clock.elapsedTime
    u.uClouds.value = settings().clouds
    const m = mesh.current
    if (!m) return
    m.visible = u.uOpacity.value > 0.01
    m.position.copy(camera.position)
  })
  return <mesh ref={mesh} geometry={geo} material={mat} raycast={() => null} frustumCulled={false} renderOrder={1} visible={false} />
}
