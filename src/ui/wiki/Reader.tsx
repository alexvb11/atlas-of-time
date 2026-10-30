import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useReader } from './store'
import { ArticleView } from './ArticleView'

/**
 * The reader: a sheet beside the globe where any link can be read in full. Each click goes one step
 * deeper and the trail shows how you got here, so following links is a way to wander through history.
 */
export function Reader() {
  const stack = useReader((s) => s.stack)
  const top = stack[stack.length - 1]
  const ref = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!top) return
    scroller.current?.scrollTo({ top: 0 })
    ref.current?.focus({ preventScroll: true })
  }, [top])

  useEffect(() => {
    if (!top) return
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || useReader.getState().card) return
      e.stopImmediatePropagation()
      useReader.getState().close()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [top])

  return (
    <AnimatePresence>
      {top && (
        <motion.aside
          ref={ref}
          tabIndex={-1}
          data-keys-local
          role="dialog"
          aria-label={`Reading: ${top.split('#')[0]}`}
          initial={{ opacity: 0, x: -40, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          className="glass pointer-events-auto fixed inset-0 z-40 flex flex-col outline-none md:inset-auto md:top-[168px] md:bottom-4 md:left-4 md:w-[min(520px,calc(100vw-470px))] md:min-w-[380px] md:rounded-[30px]"
        >
          <div className="flex shrink-0 items-center gap-2 px-4 pt-[max(14px,env(safe-area-inset-top))] pb-2 md:pt-4">
            {stack.length > 1 && (
              <button type="button" onClick={() => useReader.getState().back()} className="bubble grid size-9 shrink-0 place-items-center text-mist" aria-label="Back">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L4 7l5 5" /></svg>
              </button>
            )}
            <nav aria-label="Reading trail" className="scroll-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[11px] whitespace-nowrap [mask-image:linear-gradient(90deg,#000_calc(100%-20px),transparent)]">
              <span className="shrink-0 text-[9.5px] font-semibold tracking-[0.16em] text-dim uppercase">Trail</span>
              {stack.map((s, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1">
                  {i > 0 && <span className="text-dim/70">→</span>}
                  <button
                    type="button"
                    disabled={i === stack.length - 1}
                    onClick={() => useReader.setState({ stack: stack.slice(0, i + 1) })}
                    className={`rounded-full px-2 py-0.5 ${i === stack.length - 1 ? 'bg-amber/90 text-void' : 'text-mist hover:bg-white/8 hover:text-ink'}`}
                  >
                    {s.split('#')[0]}
                  </button>
                </span>
              ))}
            </nav>
            <button type="button" onClick={() => useReader.getState().close()} className="bubble grid size-9 shrink-0 place-items-center text-mist" aria-label="Close reader (Escape)">
              <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
            </button>
          </div>
          <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            <AnimatePresence mode="wait">
              <motion.div key={top} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <h2 className="mt-1 mb-3 font-display text-[32px] leading-[1.05] text-ink">{top.split('#')[0]}</h2>
                <ArticleView title={top} />
                <p className="mt-6 text-center text-[11px] text-dim">Hover any underlined name for a quick look; click it to keep reading.</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
