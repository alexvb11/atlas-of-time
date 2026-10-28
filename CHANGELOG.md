# Changelog

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
