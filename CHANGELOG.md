# Changelog

## 0.4.0 — 2026-10-28

### Performance pass
Measured with `scripts/qa/perf.mjs` (real GPU, empty cache; `--mobile` = 390×844 with a 4× slower CPU) and Lighthouse 12, against the previous commit on the same compressed server.
- **First scrub across all time on a throttled phone**: 42 → 60 fps, worst frame 142 → 27 ms, 12 → 0 long tasks.
  Border snapshot geometry (bbox, area, label point) is precomputed at build time; snapshot parsing,
  border line building and drift decoding (plus the plate-stretch check) run in Web Workers; the
  speed and tab pills no longer trigger Framer Motion layout measurement on every frame.
- **First-visit download**: 6.3 → 3.7 MB on phones, 6.2 → 4.5 MB on desktop. Textures are WebP (data
  textures lossless and bit-identical; the unused elevation channel is dropped). The 4K day texture
  was preloaded on phones and downloaded twice on desktop; texture preloads are gone (see below). Automated
  entity summaries load after the intro, on demand (index 437 → 114 KB gzipped). Population series
  are thinned losslessly at their stored precision. The command palette is its own chunk.
- **Load stalls**: textures decode via `createImageBitmap` off the main thread (upload stall 411 → 72 ms
  on a throttled phone).
- **Lighthouse** (mobile / desktop): performance 49 → 57 / 72 → 78, total blocking time 720 → 370 ms /
  230 → 100 ms, accessibility 100, best practices 100, SEO 91 → 100 (robots.txt). Mobile LCP stays
  high (17 s on simulated slow 4G) because the largest paint is the intro title, shown after textures load.
- **Night lights and clouds no longer hold the intro**: they load after the critical textures, with their
  own loading manager, and fade in. On a phone over slow 4G (CPU 4× slower) the globe is interactive
  after 12.3 s and 1.8 MB.
- **Fix: a stuck loading screen on slow connections.** Under slow 4G, three's `fetch()` attached to an
  in-flight `<link rel="preload">` and failed with "Failed to fetch" when the preload completed, and a
  failed texture left the loading screen up forever. The texture preloads are removed (0.5 s later
  textures on slow 4G, no failure), and texture loads retry twice before giving up.
- **Accessibility**: globe labels are at least 12 px; faded-out event markers leave the tab order and
  the accessibility tree; event markers and "More" have 24 px hit targets (WCAG 2.2).
  `scripts/qa/a11y.mjs` checks target sizes on a phone, focus indicators and Escape.

## 0.3.0 — 2026-10-28

### Phase 6: data coverage in three tiers
- **Tier 1, curated**: 160 entities and 26 dated lineages, up from 77 and 10. New lineages cover
  Persia/Iran (Elam to the Islamic Republic), Mesopotamia/Iraq (Sumer, Akkad, Ur III, Babylonia,
  Assyria to the Republic), Anatolia/Türkiye, Russia, India, Japan, both Koreas, the caliphates and
  Arabia, Spain, France, Germany, Peru, Mali and the Mongols, plus the United States. Egypt's
  lineage now runs through the caliphates, the Fatimids and the Mamluks.
- **Language catalogue**: 91 languages, up from 57. Shares are sourced where possible: the 1897
  census for the Russian Empire and the 1989 census for the USSR, with the source shown under the
  chart.
- **Tier 2, automated**: all 250 present-day countries identified on Wikidata by ISO code, each
  with a predecessor chain (P1365/P155, two steps). Unqualified modern facts (government, capital,
  languages, flag, area, currency, summary) only appear from 1945, or after the last predecessor
  ends if that is later. Sweden's "representative democracy" never shows in the year 900, and
  Egypt's "republic" starts in 1953, not 1922.
- **Tier 3, automated**: 821 border-data names matched to Wikipedia/Wikidata. Each match is
  validated by Wikidata class (polity, people or culture; never a city, region or "Culture of X"
  overview), date overlap with the snapshots that use the name, and distance from the polygon.
  Colonial labels such as "Algeria (France)" are never matched to today's sovereign state. 25
  generic labels are deliberately unmapped.
- **Coverage**: 50% of border-data names and 62% of polygon appearances now link to an entity.
  `scripts/reports/tier3-decisions.json` records the evidence for every match;
  `unmatched-basemap-names.json` is the remaining work list.
- **UI**: automated entities carry a quiet "assembled/matched automatically; not yet reviewed" note,
  "c." dates when the dates come from the maps, and language lists without invented shares. Where
  a catalogue language matches, a greeting is shown.

### Fixes
- Province-level entities no longer claim imperial polygon names. Before, a click anywhere in the
  Roman, Sasanian or Russian empires could resolve to Roman Britain, Persarmenia or the Erivan
  Governorate. "Celts" polygons no longer resolve to Iron Age Britons.
- Coastal clicks that miss simplified country polygons (Stockholm) no longer read as open sea;
  ocean names are more specific (Baltic, North Sea, Black Sea, Caspian, Red Sea, Persian Gulf).
- Prehistory fallback after 800 BCE says "Iron Age peoples" instead of "Bronze Age peoples".

### Engineering notes
- Wikimedia rate-limits anonymous clients (HTTP 429). The pipeline was redesigned around about 100
  batched Wikidata SPARQL queries instead of thousands of search calls. It honours `Retry-After`,
  has request timeouts, and caches every response, so rebuilds are offline.
- `entities-auto.json` is 437 KB gzipped and loads in parallel with the textures. Frame rate is
  unchanged (60 fps idle, 58 fps scrubbing).
- The consistency audit now covers 17 places across all tiers (34 random dates plus deep time); all
  checks pass.

## 0.2.0 — 2026-10-28

### Phases 5–8 (partial)
- **Events and routes**: 60 dated, geolocated events fade in as time approaches and fade out after.
  Upcoming events show as hollow rings with italic labels; past events show as solid, pulsing dots.
  Clicking one opens an event card with links to the entities involved. Seven historic routes (Silk
  Road and its Caucasus branch, Columbian exchange, Manila galleons, Mongol expansion west and south,
  Zheng He) glow as flowing arcs during their active periods.
- **Opening sequence**: loading ring with drifting motes, then a drift in from deep space while the
  sun rises over the limb and "Atlas of Time" resolves from wide letter-spacing and blur. The full
  sequence plays on first visit only (localStorage, wrapped in try/catch) and has a skip button.
  Repeat visits get a 1.8 s settle.
- **Command palette** (⌘K): fuzzy search over curated entities, countries and polities on the
  current map. Things that exist at the current time rank first; others are labelled
  "Jump to <year>" and move the slider when picked.
- **Sound** (off by default): procedural Web Audio drone, whoosh on fly-to, tick on milestone snap,
  a faint rising tone during time warp.
- **Consistency audit** (`npm run qa:audit`): 20 random dates × 5 places plus deep time. All pass.

### Fixes found in screenshot review
- Antimeridian-crossing rings were triangulated across the whole map (land mesh area 6.1 sr instead
  of about 3.7 sr). Rings are now unwrapped before triangulation, and GPlates results are reused per
  vertex, so the rebuild only requested the 2,015 new points.
- Deep-time triangles stretched across plates faded out; crust the plate model does not place at a
  time is now a faint ghost instead of inferred shards. Snapshots older than about 500 Ma are
  rendered at reduced confidence with a note.
- Present-day ice and vegetation leaked into deep time; land now takes only relief and texture from
  the photo and its colour from the period palette.
- Historical-basemaps rings use RFC 7946 winding, which d3-geo reads as the complement. Labels were
  appearing at the antipode; areas and centroids are now corrected.
- Anachronisms in the border data are no longer trusted. "Neanderthal" polygons stop at 40 ka, and a
  polity name that belongs to a curated entity outside its dates (e.g. "Sui Empire" in 700 CE)
  defers to the dated lineage (Tang).
- Outdated modern names in the 2010 border data ("Zaire") are replaced with today's country names.
- Slider era labels are culled by measured width; the readout gets a soft scrim over bright clouds;
  the camera frames the globe below the time bar and beside the panel.

## 0.1.0 — 2026-10-28

### Phases 1–4
- Vite 8, React 19, R3F 9, drei, postprocessing, GSAP, Framer Motion, Zustand, Tailwind 4.
- **Earth**: custom shader with the day texture, night lights limited to the modern era (fading in
  1870→1985), a soft terminator with a dusk band, ocean glint from the land mask, and limb haze.
  Sea level is driven by GEBCO bathymetry (Beringia, Doggerland and Sundaland appear at the glacial
  maximum), and LGM ice sheets scale with sea level. A back-face Fresnel atmosphere follows the sun.
  Drifting clouds thin out in deep time.
- **Space**: 6,500 stars in a soft galactic band; during fast scrubs they stretch into radial streaks.
  A faint fbm nebula sits in one region of the sky. Post-processing: low bloom, vignette, and
  chromatic aberration only while time moves fast.
- **Time engine**: one store, astronomical years, and a segmented nonlinear slider (deep time
  log / prehistory log / history piecewise linear). It snaps to milestones on release, supports
  keyboard nudges and era jumps, and plays at 1×, 5× or 25×.
- **Deep-time drift**: GPlates MERDITH2021, 101 snapshots, GPU interpolation, selection follows its
  crust, paleolatitude in the Geography tab.
- **Historical borders**: 55 snapshots from historical-basemaps, crossfaded near each transition,
  with polity labels sized by area and revealed by zoom.
- **Selection and resolution**: location-based, using dated lineages per present-day country. A
  fly-to arcs along the great circle and settles at a drone angle. The selected territory extrudes
  with a luminous rim while the world dims.
- **Panel**: Overview (ticking counters, confidence tags, did-you-know facts), Languages (packed
  bubble chart that morphs between eras, family tree, greetings in native script with Web Speech
  playback), History (lived vs upcoming, auto-scrolling "now"), Geography (paleolatitude in deep
  time, sea level, neighbours). Includes a lineage breadcrumb and a mobile bottom sheet.

### Beyond the brief
- Selected-place population is paired with "people within today's borders" (HYDE), a like-for-like
  number for every era even where a polity's own population is unknown.
- Event markers distinguish lived history from what comes next, mirroring the History tab.
