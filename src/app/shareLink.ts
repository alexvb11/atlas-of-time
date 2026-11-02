// Share links: the year, the selected place and the article being read live in the URL hash
// (#t=1789.54&at=2.35,48.85&read=Storming_of_the_Bastille), so a link reopens exactly that view.
// The hash is kept up to date with replaceState (no history entries), a few times a second at most.
import { useEffect } from 'react'
import { useTime } from '../time/store'
import { useReader } from '../ui/wiki/store'
import { goTo } from '../ui/TimeBar'
import { PRESENT } from '../time/scale'

type Shared = { t?: number; at?: [number, number]; read?: string }

export function parseHash(hash = location.hash): Shared {
  const p = new URLSearchParams(hash.replace(/^#/, ''))
  const out: Shared = {}
  const t = Number(p.get('t'))
  if (p.has('t') && Number.isFinite(t) && t <= PRESENT && t > PRESENT - 760e6) out.t = t
  const at = p.get('at')?.split(',').map(Number)
  if (at && at.length === 2 && at.every(Number.isFinite) && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90) out.at = [at[0], at[1]]
  const read = p.get('read')
  if (read) out.read = read.replace(/_/g, ' ').slice(0, 300)
  return out
}

export function currentLink(): string {
  const s = useTime.getState()
  const p = new URLSearchParams()
  p.set('t', s.time.toFixed(Math.abs(s.time) > 1e5 ? 0 : 2))
  if (s.selection) p.set('at', s.selection.map((x) => x.toFixed(3)).join(','))
  const top = useReader.getState().stack.at(-1)
  if (top) p.set('read', top.replace(/ /g, '_'))
  const url = new URL(location.href)
  url.hash = p.toString().replace(/%2C/g, ',')
  url.searchParams.delete('qa')
  return url.toString()
}

/** Applies a shared link once the intro is done, then keeps the hash in step with the view */
export function useShareLink() {
  const introDone = useTime((s) => s.introDone)
  useEffect(() => {
    if (!introDone) return
    const apply = () => {
      const sh = parseHash()
      if (sh.t !== undefined) goTo(sh.t, 1.2)
      if (sh.at) useTime.getState().select(sh.at)
      if (sh.read) useReader.getState().open(sh.read)
    }
    if (location.hash.length > 1) apply()
    let timer = 0
    const write = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        const next = currentLink()
        if (next !== location.href) history.replaceState(null, '', next)
      }, 400)
    }
    const unTime = useTime.subscribe((s) => [s.time, s.selection] as const, write, { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] })
    const unRead = useReader.subscribe(write)
    // a link pasted into an open tab
    const onHash = () => apply()
    window.addEventListener('hashchange', onHash)
    return () => {
      unTime()
      unRead()
      clearTimeout(timer)
      window.removeEventListener('hashchange', onHash)
    }
  }, [introDone])
}
