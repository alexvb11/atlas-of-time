// Interface translations. The interface follows the reading language (src/data/wiki.ts), so one
// choice sets both the buttons and the Wikipedia articles. Strings are keyed by their English text;
// anything a dictionary lacks shows in English. Each language loads only when chosen.
import { useSyncExternalStore } from 'react'
import { getLang, onLang } from '../data/wiki'

type Dict = Record<string, string>
const files = import.meta.glob<{ default: Dict }>('./*.json')
let dict: Dict = {}
let loaded = 'en'
const listeners = new Set<() => void>()

async function load(lang: string) {
  const f = files[`./${lang}.json`]
  const next = f ? (await f()).default : {}
  // a later choice may have won while this one loaded
  if (getLang() !== lang) return
  dict = next
  loaded = lang
  document.documentElement.lang = lang
  listeners.forEach((l) => l())
}
load(getLang())
onLang(() => load(getLang()))

/** The interface text for an English string, in the current language */
export const tr = (en: string) => dict[en] ?? en

/** Re-renders when the interface language changes; returns tr */
export function useT() {
  useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => loaded,
  )
  return tr
}
