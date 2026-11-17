// The sky as seen standing on the ground: a dome around the viewer coloured by the sun's height
// (blue noon, warm dusk, dark night with the stars showing through), with the sun's disk and glare.
// The globe's atmosphere shell is made for looking in from space and washes out from inside, so it
// steps aside while this is up (Globe.tsx).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { rig } from './CameraRig'
import { SUN } from './world'

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
uniform float uOpacity;
varying vec3 vDir;
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
  sky += vec3(9.0, 8.2, 6.8) * disk;
  // night: a faint deep blue with airglow at the horizon
  vec3 night = vec3(0.012, 0.018, 0.045) + vec3(0.02, 0.03, 0.05) * pow(1.0 - h, 6.0);
  vec3 col = mix(night, sky, day);
  // below the horizon (where no ground is drawn, over the sea): dark water-coloured ground
  if (ve < 0.0) col = mix(vec3(0.05, 0.07, 0.09) * (0.2 + 0.8 * day), col, exp(ve * 40.0));
  float a = mix(0.3, 1.0, day) * uOpacity;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function GroundSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uSun: { value: SUN }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 0 } },
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
  useFrame(({ camera }) => {
    const want = rig.groundBlend
    mat.uniforms.uOpacity.value += (want - mat.uniforms.uOpacity.value) * 0.2
    ;(mat.uniforms.uUp.value as THREE.Vector3).copy(camera.position).normalize()
    const m = mesh.current
    if (!m) return
    m.visible = mat.uniforms.uOpacity.value > 0.01
    m.position.copy(camera.position)
  })
  return <mesh ref={mesh} geometry={geo} material={mat} raycast={() => null} frustumCulled={false} renderOrder={1} visible={false} />
}
