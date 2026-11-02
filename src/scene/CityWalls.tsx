// City walls (src/data/citywalls.ts) drawn on the ground when flying low, from the year each was
// finished. Drawn over the terrain so a wall on a ridge (Seoul's climbs Bugaksan) stays visible.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { lonLatToVec3 } from '../geo/sphere'
import { CITY_WALLS, type CityWall } from '../data/citywalls'
import { settings, useSettings } from '../time/settings'
import { useReader } from '../ui/wiki/store'
import { world } from './world'

type Outlines = Record<string, number[][]>
let data: Promise<Outlines> | null = null
const load = () => (data ??= fetch(`${import.meta.env.BASE_URL}data/citywalls.json`).then((r) => r.json()))

const R = 6371000

function WallView({ w, lines }: { w: CityWall; lines: number[][] }) {
  const { camera, size } = useThree()
  const obj = useMemo(() => {
    const pos: number[] = []
    const v = new THREE.Vector3()
    for (const l of lines)
      for (let i = 0; i + 3 < l.length; i += 2) {
        lonLatToVec3(l[i], l[i + 1], 1, v)
        pos.push(v.x, v.y, v.z)
        lonLatToVec3(l[i + 2], l[i + 3], 1, v)
        pos.push(v.x, v.y, v.z)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const m = new THREE.LineBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    const seg = new THREE.LineSegments(g, m)
    seg.renderOrder = 6
    seg.frustumCulled = false
    seg.raycast = () => {}
    return seg
  }, [lines])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )

  const tag = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const host = document.getElementById('globe-events')
    if (!host) return
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'landmark-tag'
    el.innerHTML = `<span class="dot"></span><span class="txt">${w.name} <i>${w.built}</i></span>`
    el.setAttribute('aria-label', `${w.name}, ${w.built}. Read about it`)
    el.onclick = () => useReader.getState().open(w.article)
    el.style.opacity = '0'
    el.style.visibility = 'hidden'
    host.appendChild(el)
    tag.current = el
    return () => el.remove()
  }, [w])

  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const alt = camera.position.length() - 1
    const on = settings().cityWalls && world.drift < 0.01 && world.t >= w.from
    // from about 200 km up, full by 60 km
    const want = on ? THREE.MathUtils.smoothstep(0.032 - alt, 0, 0.022) * 0.95 : 0
    const m = obj.material as THREE.LineBasicMaterial
    m.opacity += (want - m.opacity) * 0.15
    obj.visible = m.opacity > 0.01
    // stand at the town's height, so the lines sit on the ground rather than under it
    obj.scale.setScalar(1 + (w.elev * settings().terrain) / R)
    const el = tag.current
    if (!el) return
    lonLatToVec3(w.at[0], w.at[1], 1 + (w.elev * settings().terrain) / R, v)
    const facing = v.clone().normalize().dot(camera.position.clone().normalize())
    const op = on && alt < 0.02 && facing > 0.99 && v.distanceTo(camera.position) < 0.016 ? 1 : 0
    el.style.opacity = String(op)
    el.style.visibility = op ? 'visible' : 'hidden'
    if (!op) return
    v.project(camera)
    el.style.transform = `translate(${((v.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * size.height).toFixed(1)}px)`
  })
  return <primitive object={obj} />
}

export function CityWallsLayer() {
  const on = useSettings((s) => s.cityWalls)
  const [lines, setLines] = useState<Outlines | null>(null)
  useEffect(() => {
    if (on && !lines) load().then(setLines, () => {})
  }, [on, lines])
  if (!on || !lines) return null
  return (
    <>
      {CITY_WALLS.filter((w) => lines[w.id]).map((w) => (
        <WallView key={w.id} w={w} lines={lines[w.id]} />
      ))}
    </>
  )
}
