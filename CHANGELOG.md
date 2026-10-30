# Changelog

## 0.7.0 — 2026-10-30

### Precise borders
- **1886 to today: CShapes 2.0** (ETH Zürich, CC BY-NC-SA 4.0). Every territorial change is dated to
  the day, and the map switches on that day: 765 dated border states instead of eleven snapshots.
  Geometry is simplified only below 200 m and stored as one 2 MB TopoJSON (shared borders stored
  once), assembled in the worker for each date. Scrubbing all of time still runs at 59 fps.
- **Period-correct names.** CShapes gives a unit one modern name for its whole history, so each
  piece is named for its date. Independent states follow the Gleditsch–Ward lists, with renames on the
  day: Russian Empire → Soviet Russia → Soviet Union → Russia, Persia → Iran, Siam → Thailand → Siam →
  Thailand, Upper Volta → Burkina Faso, Zaire. Dependencies take their period name and ruler from a
  dated, hand-checked table: Congo Free State, then Belgian Congo; Imperial British East Africa,
  East Africa Protectorate, then Kenya Colony; the Soviet republics as SSRs. Pieces CShapes keeps
  between the end of an empire and its peace treaty are named for what they were ("Former Austrian
  crown lands, borders until the Treaty of Saint-Germain"). An earlier attempt to borrow names from
  the older border maps was dropped after review: it called French Senegal "Futa Toro" and Portuguese
  Timor "Netherlands Indies".
- **Before 1886**: historical-basemaps now keeps its full source detail down to 1 km (it kept 12% of
  vertices), at a precision of 0.001°.
- The panel and the corner note say which source draws the borders at the current date.

### What happened here
- New **Here** tab: click any point and it lists what happened near there around the current date,
  from 11,133 dated Wikidata events with coordinates (battles, sieges, treaties, revolutions,
  assassinations, massacres, earthquakes, eruptions, shipwrecks, fires, floods, expeditions…),
  closest in time and space first, with distance and direction, numbered pins on the globe, a
  "here, this year" tag, *Go there*, and the full article on click. The window scales with time
  (±2 years recently, up to ±150 in antiquity). Each year is confirmed against the event's Wikipedia
  lead before it is shown; events whose article gives a different year are left out and counted.

### Picture films
- Back and forward buttons on every film, and the arrow keys: with a hover card open, or while
  pointing at or focused on a film. They no longer move the time slider while doing so.

### Build
- mapshaper runs through the current Node binary instead of the `.bin` shim, so `npm run data`
  works without `node` on the PATH and on Windows.

## 0.6.0 — 2026-10-30

### Accuracy audit
Every hand-written statement (160 entities, 304 events, 218 reigns, 214 capitals, 215 facts) was
read against standard references, and `scripts/qa/fact-check.mjs` now cross-checks event years,
entity spans and reigns against Wikidata and the cited articles. Corrections:
- **Wrong periods in lineages**: Spain, Greece and Türkiye showed the *Roman Empire* during the
  Roman Republic; Armenia showed Safavid rule after the Safavids fell (1736–47 is now Afsharid).
- **Dates**: Kingdom of Macedon began c. 808 BCE (not 338) and ended at Pydna, 168 BCE; Ottoman
  capital Bursa from 1326 (not 1335); Timurid capital Herat from 1409; Zand capital Shiraz from 1765;
  Ptolemy I reigned to 282 BCE; Pyramid of the Sun c. 200 CE in both places it appears; October
  Revolution dated to November 1917 (New Style); the UK's present name dates from 1927.
- **Capitals**: New York (1785–90) added for the United States; the Visigoths reached Toledo
  c. 560, not 507; Aachen became Charlemagne's seat in the 790s; Fatimid capitals Raqqada, Mahdia
  and al-Mansuriya before Cairo; Dur-Sharrukin for Assyria; Shangdu before Khanbaliq; Delhi, then
  New Delhi from 1931.
- **Names and governments**: Egypt was the Republic of Egypt and the United Arab Republic before
  1971; Mexico's centralist republic (1835–46), Spain's First Republic (1873–74) and Georgia's
  presidential and semi-presidential periods are now shown; Russian Armenia was the Armenian Oblast
  only until 1840; Heian Japan is no longer described as Fujiwara-run throughout; Mary I's Catholic
  restoration (1553–58) is shown for England.
- **Languages**: the Marathas spoke Marathi (not Hindi and Tamil); Tamil is no longer listed for
  the Vedic, Maurya and Gupta periods; the Goths spoke Gothic (not Old Norse); Old High German is no
  longer used for ancient Germanic peoples; Old Korean replaces Middle Korean before 935; Caucasian
  Albania has its own language; "Mongolian" is gone from 3rd–6th century China.
- **Language shares**: percentages are only shown where a census backs them (the Russian Empire's
  1897 census, now labelled as selected languages), and shown as recorded: the chart used to rescale
  the listed languages to 100%, which showed Russian at ~58% instead of the census's 44%. Elsewhere the panel lists the languages without
  numbers instead of estimates that looked like facts.
- **Wording**: Italy and China now share the lead in World Heritage Sites; Sutton Hoo is "one of"
  the richest finds; the Black Death killed a third to a half of Europe; Caesar died in the Curia of
  Pompey; Toba is "one of the largest" eruptions; whether Korea's turtle ships were iron-clad is
  marked as debated; the Aztec Empire no longer shows Tenochtitlan's population as its own; the
  Armenian genocide toll is given as the range scholars use.
- **Wrong article**: "Hittites sack Babylon" (1595 BCE) opened the article on Babylon's fall in
  539 BCE; it now opens *Mursili I*.
- **Automated data**: heads of state without an end date no longer stretch to the end of their
  state (As-Saffah no longer "rules" the Abbasids until 1258); a name that Wikidata could not label
  is taken from its English article, or left out, instead of shown as a raw id ("Q2105" for
  Jacques Chirac, whose Wikidata item has lost its English label).

### History for every country
- Every present-day country's History tab now lists its most widely covered dated events from
  Wikidata (`country-events.mjs`): wars, battles, sieges, treaties, revolutions, coups, rebellions,
  declarations of independence, assassinations, massacres, genocides, famines, epidemics,
  earthquakes and eruptions. Titles are the Wikipedia article titles word for word; every one opens
  as an article with its film and hover cards. Two filters keep it honest: events tagged to more
  than three countries (pandemics, world wars, UN conventions) are left out, and an event is kept
  only if its Wikidata year also appears in the article's own lead. That second check caught real
  Wikidata errors, such as the Convention of Kanagawa dated 1864 instead of 1854.
- Every period heading in the History tab (automated predecessor states too) opens its article, and
  the Overview tab has *Read the story of …* for every entity.

## 0.5.0 — 2026-10-30

### The reader: history in depth
- **Every event opens.** In the History tab, clicking an event (or a period heading) drops down a
  short article: a film of its pictures, the whole Wikipedia lead, and folding *Background* and
  *Aftermath* / *Legacy* (or *Early life* for people). The year still jumps the slider. All 304
  events and 160 entities have a hand-picked article, checked to exist and not be a
  disambiguation page (`npm run data:articles`). Event cards on the globe get *Read the story*.
- **Hover cards.** Every link in an article is underlined and opens a card on hover, focus or tap:
  one bubble with a picture film on top and the definition below, plus *Read the story*, *Show on
  globe* (for places) and the atlas's own date when the subject is one of its entities.
- **Picture films.** A title card, then up to eight of the article's own pictures with slow Ken
  Burns moves (portraits drift toward the face, with a soft fill on the sides), captions and dates
  as lower thirds, film grain, an old-stock grade and flicker on pictures dated before 1900, and,
  for people, their real signature written onto parchment as the closing shot (Wikidata P109).
  Click to pause; segments jump between shots. Reduced motion keeps cuts but drops movement.
  Every frame is a real image with a link to its Commons page; nothing is generated.
- **Reading trail.** Clicking any link reads it in a sheet beside the globe (full screen on
  phones). The trail shows the path (Declaration → Thomas Jefferson → Monticello…); Back and any
  crumb walk it.
- **Live, not bundled.** Article text and pictures come from Wikipedia when opened, cached for the
  session; the build only ships the 22 KB event → article map. Bulk build-time fetching was ruled
  out: Wikipedia rate-limits anonymous scripts after a few hundred requests, and readers can follow
  any of millions of links.
- **Fix**: years with a fraction (1776.5 = July 1776) were rounded up, so the Declaration of
  Independence and the United States showed 1777. Years now floor.
- `scripts/qa/reader.mjs` walks the whole path on desktop and phone (article 1.9–2.4 s, card
  0.34 s on a warm connection; no console errors).

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
