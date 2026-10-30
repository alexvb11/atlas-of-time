import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Shot } from '../../data/wiki'
import { useTime } from '../../time/store'

// A short documentary cut from the pictures a Wikipedia article itself uses: a title card, then
// each portrait, painting, photo or document with a slow Ken Burns move, its caption as a lower
// third, film grain, and an old-film grade on pictures made before 1900. Signatures are "written"
// onto parchment. Nothing is generated; every frame is a real image, credited on Commons.

const TITLE_MS = 2400
const SHOT_MS = 3800
const FADE = 0.9

// Ken Burns moves, cycled so consecutive shots never move the same way
const MOVES: [string, string][] = [
  ['scale(1.04) translate(0%, 0%)', 'scale(1.22) translate(-2%, 3%)'],
  ['scale(1.2) translate(4%, 0%)', 'scale(1.08) translate(-4%, -1%)'],
  ['scale(1.24) translate(-2%, -3%)', 'scale(1.05) translate(1%, 1%)'],
  ['scale(1.16) translate(-4%, 1%)', 'scale(1.16) translate(4%, -1%)'],
  ['scale(1.06) translate(0%, 4%)', 'scale(1.2) translate(0%, -2%)'],
]
// portraits in a wide frame: drift toward the upper third, where faces usually are
const PORTRAIT: [string, string] = ['scale(1) translate(0%, 0%)', 'scale(1.32) translate(0%, 9%)']

const yearOf = (s: string) => {
  const m = s.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)
  return m ? Number(m[1]) : null
}

type Props = { title: string; subtitle?: string | null; shots: Shot[] | undefined; poster?: string | null; failed?: boolean; className?: string }

export function Film({ title, subtitle, shots, poster, failed, className = '' }: Props) {
  const reduced = useTime((s) => s.reducedMotion)
  // fall back to the summary's lead image when the article has no usable pictures
  const reel = useMemo<Shot[]>(() => {
    if (shots?.length) return shots
    if (poster) return [{ src: poster, srcset: poster, caption: '', file: '', signature: false }]
    return []
  }, [shots, poster])
  const [i, setI] = useState(-1) // -1 = title card
  const [playing, setPlaying] = useState(true)
  const [aspect, setAspect] = useState<Record<number, number>>({})
  const [ready, setReady] = useState<Set<number>>(new Set())
  const timer = useRef<number>(0)

  // restart when the subject changes
  useEffect(() => {
    setI(-1)
    setReady(new Set())
    setAspect({})
  }, [title])

  // preload the current and next picture so a cut never shows an empty frame
  useEffect(() => {
    for (const k of [Math.max(0, i), i + 1]) {
      const s = reel[k]
      if (!s || ready.has(k)) continue
      const img = new Image()
      img.srcset = s.srcset
      img.src = s.src
      img.onload = () => {
        setAspect((a) => ({ ...a, [k]: img.naturalWidth / img.naturalHeight }))
        setReady((r) => new Set(r).add(k))
      }
      img.onerror = () => setReady((r) => new Set(r).add(k))
    }
  }, [i, reel, ready])

  useEffect(() => {
    if (!playing || !reel.length) return
    const next = i + 1 >= reel.length ? (reel.length > 1 ? 0 : -1) : i + 1
    // hold on the title card until the first picture has arrived
    if (i === -1 && !ready.has(0)) return
    const ms = i === -1 ? TITLE_MS : reel[i]?.signature ? 3200 : SHOT_MS
    timer.current = window.setTimeout(() => setI(next), ms)
    return () => clearTimeout(timer.current)
  }, [i, playing, reel, ready])

  const shot = i >= 0 ? reel[i] : null
  const ar = shot ? aspect[i] : undefined
  const year = shot ? yearOf(shot.caption) ?? yearOf(shot.file) : null
  const old = year !== null && year < 1900
  const move = ar !== undefined && ar < 1.05 ? PORTRAIT : MOVES[(i < 0 ? 0 : i) % MOVES.length]
  const caption = shot?.caption ? (shot.caption.length > 120 ? shot.caption.slice(0, 117).replace(/\s+\S*$/, '') + '…' : shot.caption) : ''
  const commons = shot?.file ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(shot.file.replace(/ /g, '_'))}` : null

  return (
    <div
      className={`film group/film relative aspect-video overflow-hidden bg-[#050505] select-none ${className}`}
      onClick={() => setPlaying((p) => !p)}
      role="img"
      aria-label={`Picture film about ${title}${caption ? `: ${caption}` : ''}`}
    >
      <AnimatePresence initial={false}>
        {shot ? (
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.4 : FADE, ease: 'easeInOut' }}
          >
            {shot.signature ? (
              <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#f3ead6,#d8c9a6)]">
                <img
                  src={shot.src}
                  srcSet={shot.srcset}
                  alt=""
                  className="film-sign max-h-[62%] max-w-[78%] object-contain mix-blend-multiply"
                  style={{ animationPlayState: playing ? 'running' : 'paused' }}
                />
              </div>
            ) : (
              <>
                {/* portraits: a soft, enlarged copy fills the sides, as in broadcast documentaries */}
                {ar !== undefined && ar < 1.3 && <img src={shot.src} alt="" className="absolute inset-0 size-full scale-125 object-cover opacity-60 blur-xl" />}
                <img
                  src={shot.src}
                  srcSet={shot.srcset}
                  alt=""
                  className={`film-kb absolute inset-0 size-full ${ar !== undefined && ar < 1.3 ? 'object-contain' : 'object-cover'} ${old ? 'film-old' : ''}`}
                  style={{
                    ['--kb-from' as string]: move[0],
                    ['--kb-to' as string]: move[1],
                    animationDuration: `${SHOT_MS + FADE * 1000}ms`,
                    animationPlayState: playing && !reduced ? 'running' : 'paused',
                  }}
                />
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="title" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: FADE }}>
            {reel[0] && <img src={reel[0].src} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-md" />}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,.2),rgba(0,0,0,.75))]" />
            <div className="film-sweep absolute inset-0" />
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <motion.div
                  initial={reduced ? false : { letterSpacing: '0.42em', opacity: 0, filter: 'blur(8px)' }}
                  animate={{ letterSpacing: '0.04em', opacity: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[clamp(20px,6.5cqw,34px)] leading-[1.05] text-[#f6efe2] [text-shadow:0_2px_18px_rgba(0,0,0,.8)]"
                >
                  {title}
                </motion.div>
                {subtitle && (
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.9 }}
                    className="mx-auto mt-1.5 max-w-[34ch] text-[10px] font-semibold tracking-[0.2em] text-amber/90 uppercase"
                  >
                    {subtitle}
                  </motion.div>
                )}
                {(failed || (shots && !reel.length)) && <div className="mt-2 text-[10.5px] text-white/50">{failed ? 'Pictures could not be loaded' : 'No pictures on Wikipedia'}</div>}
                {!failed && !shots && <div className="film-dots mt-2 text-[10.5px] text-white/50">Developing film</div>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* lower third */}
      <AnimatePresence>
        {shot && (caption || year) && (
          <motion.div
            key={'c' + i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pt-8 pb-2.5"
          >
            <div className="flex items-end gap-2">
              {year !== null && <span className="shrink-0 rounded-sm bg-amber/90 px-1.5 py-px text-[10px] font-semibold text-void tnum">{year}</span>}
              {caption && <p className="line-clamp-2 text-[11px] leading-snug text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,.9)]">{caption}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* film stock: grain, gate weave vignette, and a projector flicker on old pictures */}
      <div className={`film-grain pointer-events-none absolute inset-0 ${reduced ? '' : 'animate'}`} />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,.75)]" />
      {old && !reduced && <div className="film-flicker pointer-events-none absolute inset-0" />}

      {/* reel progress, one segment per picture */}
      {reel.length > 1 && (
        <div className="absolute inset-x-2.5 top-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
          {reel.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Picture ${k + 1} of ${reel.length}`}
              onClick={() => setI(k)}
              className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/25 py-0 before:absolute before:-inset-y-2 before:inset-x-0"
            >
              <span
                key={k === i ? `on${i}` : 'off'}
                className={`absolute inset-y-0 left-0 rounded-full bg-white/90 ${k < i ? 'w-full' : k === i ? 'film-progress' : 'w-0'}`}
                style={k === i ? { animationDuration: `${shot?.signature ? 3200 : SHOT_MS}ms`, animationPlayState: playing ? 'running' : 'paused' } : undefined}
              />
            </button>
          ))}
        </div>
      )}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M1 1l10 6-10 6z" /></svg>
          </span>
        </div>
      )}
      {commons && (
        <a
          href={commons}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3.5 right-2 rounded bg-black/40 px-1.5 py-px text-[9px] text-white/60 opacity-0 transition-opacity group-hover/film:opacity-100 hover:text-white focus:opacity-100"
        >
          Image credit ↗
        </a>
      )}
    </div>
  )
}
