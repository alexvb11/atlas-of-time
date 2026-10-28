// Tiny helpers so curated history reads like a timeline.
// Years are astronomical: bce(500) === -499, ce(1914) === 1914.
export const bce = (y) => 1 - y
export const ce = (y) => y
export const NOW = 2026

/** Confidence levels shown in the UI: "c." for estimated, a tag for disputed */
export const D = 'documented'
export const E = 'estimated'
export const X = 'disputed'

/**
 * Normalises a curated entity. Shapes:
 *   capitals/gov/rulers/religion/names: [from, to, text, conf?]
 *   langs: [from, to, [[langId, share], ...]]
 *   pop: [t, value, conf]
 *   events: [t, title, detail?, conf?]
 *   facts: [from, to, text] (from/to null = whole lifetime)
 */
export function entity(e) {
  return {
    conf: D,
    capitals: [],
    gov: [],
    rulers: [],
    religion: [],
    langs: [],
    pop: [],
    events: [],
    facts: [],
    match: [],
    names: [],
    sources: [],
    ...e,
  }
}
