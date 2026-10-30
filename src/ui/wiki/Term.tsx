import { useRef, type ReactNode } from 'react'
import { term, film, wikiUrl } from '../../data/wiki'
import { useReader } from './store'

// Hover timing: a short delay so sweeping the pointer across a paragraph doesn't flash cards;
// a grace period so the pointer can travel from the link into the card.
const OPEN_MS = 260
export const CLOSE_MS = 220
let closeTimer = 0
export const cancelClose = () => clearTimeout(closeTimer)
// focus returns to the link when Escape closes its card; that focus must not reopen it
let quietUntil = 0
export const quietFocus = () => (quietUntil = performance.now() + 400)
export const scheduleClose = () => {
  clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => useReader.getState().hideCard(), CLOSE_MS)
}

/** A link to another article: hover or focus shows its card, click reads it in the reader */
export function TermLink({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const openTimer = useRef(0)
  const touch = useRef(false)
  const isOpen = useReader((s) => s.card?.anchor === ref.current && !!ref.current)

  const show = (delay: number) => {
    cancelClose()
    clearTimeout(openTimer.current)
    // warm both requests the moment intent is likely, so the card opens already filled
    term(title).catch(() => {})
    film(title).catch(() => {})
    openTimer.current = window.setTimeout(() => ref.current && useReader.getState().showCard(title, ref.current), delay)
  }
  const hide = () => {
    clearTimeout(openTimer.current)
    scheduleClose()
  }

  return (
    <a
      ref={ref}
      href={wikiUrl(title)}
      className="term"
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      onPointerDown={(e) => (touch.current = e.pointerType !== 'mouse')}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show(OPEN_MS)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onFocus={() => !touch.current && performance.now() > quietUntil && show(0)}
      onBlur={hide}
      onClick={(e) => {
        // ⌘/ctrl/middle click: let the browser open Wikipedia in a new tab
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        // first tap on a touch screen shows the card; a second tap (or any mouse click) reads on
        if (touch.current && !isOpen) {
          clearTimeout(openTimer.current)
          useReader.getState().showCard(title, e.currentTarget)
          term(title).catch(() => {})
          film(title).catch(() => {})
          return
        }
        useReader.getState().open(title)
      }}
    >
      {children}
    </a>
  )
}
