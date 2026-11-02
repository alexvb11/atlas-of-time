# Atlas of Time

An interactive 3D globe from 750 million years ago to today. Scrub the time bar and the continents
drift, ice sheets grow and shrink, borders shift, and the panel tells you who lived at the place
you clicked **at that moment**: its name, rulers, languages, population and history.

Time is the single source of truth: every layer, label, marker and panel is derived from one value
in the time store, so nothing on screen ever shows modern information while you are in the past.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # static site in dist/, deployable to Vercel as-is (vercel.json included)
```

The generated data in `public/` is committed, so the site runs without rebuilding data. To rebuild it
from the original sources (takes a while, mostly GPlates requests):

```bash
npm run data           # everything
npm run data:entities  # only curated entities, events, Wikipedia/Wikidata enrichment
```

### Put it online

The site is static: `npm run build` writes `dist/`, which any static host can serve.

1. **GitHub Pages** (free, included): create an empty **public** repository named `atlas-of-time`,
   then `git remote set-url origin https://github.com/<you>/atlas-of-time.git` and
   `git push -u origin main`. In the repository, *Settings → Pages → Source*: **GitHub Actions**.
   `.github/workflows/deploy.yml` then builds and publishes every push to `main` at
   `https://<you>.github.io/atlas-of-time/` (the workflow sets `BASE_PATH` to the repository name, so
   a different name works too).
2. **Vercel** (alternative): import the repository at vercel.com/new. `vercel.json` already sets the
   build command, the output folder and cache headers; no environment variables are needed.

Keep the CShapes licence in mind: the site must stay non-commercial while it includes those borders.

### Quality checks

These need the dev server running.

```bash
npm run qa:shots   # screenshot tour of major states → scripts/qa/shots
npm run qa:audit   # 20 random dates × 5 places: does every visible element agree with the date?
npm run qa:fps     # frame rate idle / scrubbing / panel open (real GPU via headless Chromium)
node scripts/qa/perf.mjs "http://localhost:4173/?qa" --mobile --slow   # cold load + first scrub on a production build (phone CPU, slow 4G)
node scripts/qa/a11y.mjs   # touch targets, focus indicators, Escape
node scripts/qa/reader.mjs [--mobile]   # History dropdown → hover card → reader → signature (needs network)
node scripts/qa/explore.mjs   # share link, journey, moving voyage, quiz, on this day, journal (needs network)
```

## Controls

| Action | Input |
|---|---|
| Rotate / zoom | drag, wheel, pinch |
| Select a place | click (deep time: click the drifting land itself) |
| Deselect | Esc or click empty space |
| Move through time | drag the time bar (hold Shift to scrub slowly), ← / → or the ‹ › by the year step one year (Alt or Shift: ten), Page Up / Down a century, Shift+← / → jump eras, Space play/pause |
| Go to an exact year | click the big year and type it: "1066", "44 BC", "12000 years ago", "20 ka", "65 Ma" |
| Flip film pictures | ‹ › buttons, or ← / → while pointing at a film or with a hover card open |
| Search | ⌘K / Ctrl+K |
| Read an event | History tab: click the title (the year jumps the slider) · event cards: *Read the story* |
| Search a place in a year | ⌘K, then e.g. "Paris 1789" or "Rome 44 BC" |
| Share this view | link button (bottom left): copies a URL with the year, place and article |
| Journeys, quiz, compare two years, on this day, journal | Explore (bottom left) |
| Layers, map, sky, motion, labels, language, quality… | Settings (bottom left): 34 options in 8 groups, searchable, with presets; remembered in this browser |
| Who held a spot through time | click it, then the *Held by* tab |
| Look something up | hover (or focus, or tap) an underlined name; click it to read on, Back walks the trail |

## How it works

See [PLAN.md](PLAN.md) for the architecture. Short version:

- **Time axis**: astronomical years (1 BCE = 0). The slider maps a segmented, partly logarithmic
  scale onto it, so 600 Ma and 1914 are both easy to reach. Every stop is exact: a drag settles on
  the year shown, steps move one readout unit (a year in history, 100 years to 1 Ma further back),
  and any year can be typed.
- **Deep time**: back to 540 Ma the globe shows the PALEOMAP PaleoDEMs (Scotese & Wright 2018):
  mountains, lowlands, shelf seas and deep ocean every 5 million years, crossfaded, with relief;
  land colours follow what is known (bare before land plants, forests from the Devonian, drier
  subtropics, polar ice only in the known ice ages), with today's coastlines as faint guides.
  Today's land and country borders are triangulated once and every vertex is reconstructed by
  GPlates at 101 timesteps (PALEOMAP to 540 Ma so the crust matches the landscapes, MERDITH2021
  to 750 Ma). Because vertex *i* is the same
  crust in every snapshot, the GPU interpolates positions every frame. Triangles stretched across two
  plates fade out, and crust the model does not place at a given time is shown only as a ghost.
- **Selection is a location**. A click stores a present-day lon/lat; in deep time it rides its
  triangle of crust. At each time it resolves to an entity through dated lineages per present-day
  country, the historical border polygon under it, or regional prehistory. It never shows an empty
  panel.
- **Borders**: before 3400 BCE, historical-basemaps snapshots. From 3400 BCE to 1885,
  [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat, 2025): every
  shape has its own range of years, so borders move in the year they changed (449 change years), and
  every polity names its own Wikipedia article and Wikidata item. Groupings such as the Holy Roman
  Empire are labelled over their member states. Where Cliopatria records no state (peoples, cultures,
  a few states it omits), the historical-basemaps shape fills in when at least 70% of it lies outside
  every Cliopatria state. The sources' certainty shows on the map: CShapes and Cliopatria borders
  are solid, approximate ones (historical-basemaps) dashed. Cliopatria is split into eras so a visit
  loads only its own period. From 1886, CShapes 2.0: every territorial change is its own dated snapshot (765 of them),
  assembled in a worker from one shared TopoJSON. CShapes gives a unit one modern name for its whole
  history ("Kenya" from 1888), so `cshapes.mjs` names each piece for its date: independent states by
  the Gleditsch–Ward lists (Russian Empire, Soviet Russia, Soviet Union, Russia), dependencies from a
  dated, hand-checked table (Imperial British East Africa, East Africa Protectorate, Kenya Colony),
  with the ruling power. CShapes moves borders on treaty dates, so a few pieces between the collapse
  of empires and the peace treaties are named for what they were ("Former Austrian crown lands,
  borders until the Treaty of Saint-Germain").
- **The basics**: the first thing in the panel. For whatever is under the click at that date, a lead
  sentence (what it was and where) and short rows: who ruled and from where, government, religion,
  main languages, how old it was and how long it would last (or which period of a longer state it
  was), what held the spot before and after, its neighbours and size on that year's map, and the
  wider world. Every clause comes from the atlas's data and is left out when missing; automated
  modern countries get no founding year, since Wikidata's is often a predecessor's. Below it, *What
  was happening*: the opening of the Wikipedia section whose heading's years cover the date (the
  state's own article first, then "History of <country>"), quoted and linked.
- **Graphics**: physically based sky (single Rayleigh and Mie scattering, ray-marched), ocean sun
  glint with moving waves, turquoise shelves, cloud shadows, mountain relief lit from real
  elevation (GEBCO), 8K imagery on capable screens. Zoomed in, NASA GIBS Blue Marble tiles (~600
  m a pixel) stream in over 3D terrain (Terrain Tiles), and the camera leans toward the horizon;
  zoom glides. The night sky is real: the Yale Bright Star Catalogue's 9,096 stars, moved to the
  date by precession and their own motions on the GPU (Thuban is the pole star in 2800 BCE), the
  Milky Way on the galactic plane, the Moon in its place and phase for the date (Meeus), and the
  Sun. Before ~30,000 years ago, a generic starfield. Borders are screen-space lines with an
  adjustable thickness, and a *Political map* setting colours every state.
- **Held by**: for any clicked spot, every polity the border sources put there, from the earliest
  map to today, with years and source, found in one worker pass over all of them.
- **Settings** (`src/time/settings.ts`, sheet in `src/ui/explore/SettingsView.tsx`): every layer and
  most of the display can be switched or tuned, including borders, approximate borders, label size,
  clouds, night lights, atmosphere, stars, ice ages, Green Sahara, sunlight (fixed, seasons or always
  day), idle spin, motion, time-warp effects, playback speed, BCE/CE or BC/AD, the era strip, source
  notes, hover names and cards, reading language, narration and graphics quality. Presets: Standard,
  Clean map, Everything, Calm.
- **Layers**: *Trade routes* (11 routes, from the Royal Road to the Manila galleons) flow while in
  use, along schematic paths between attested stops, years from each route's article. *Population
  density* colours today's countries by people per km² from the HYDE 3.2 / UN series, back to
  10,000 BCE; today's borders are a fixed frame, and the legend says so. *Seasons and daylight* puts
  the sun over the latitude it has at that time of year (with the axial tilt of the period); at the
  present it is the real sun, over wherever it is noon now. Ice sheets, sea level and the Green
  Sahara (African Humid Period, about 14,800–5,000 years ago, with the Younger Dryas dry spell) follow
  the date without a switch.
- **Here**: click anywhere and the Here tab lists what happened near that point around that time,
  from about 11,000 located, dated Wikidata events, numbered on the globe. The window scales with
  time (a few years recently, up to 150 years in antiquity), and each year is confirmed against the
  event's Wikipedia lead before it is shown.
- **Explore**: guided journeys (the Silk Road, the Mongol conquests, the Second World War) move
  the time and camera stop by stop with a caption, optionally read aloud by the browser's speech
  synthesis. Seven dated movements (Hannibal, Columbus's first voyage, Magellan–Elcano, Lewis and
  Clark, Napoleon in 1812, and the lives of Marco Polo and Ibn Battuta, dated from their Wikipedia
  articles with uncertain dates marked) are also drawn moving on the globe whenever the time is within their
  dates, linear in time between documented stops. The quiz asks where an event happened (scored by
  distance) and who held a marked place in a given year (answers from the border data for that
  date). *Compare two years* draws a second year's borders in pink over the globe and lists the
  states on one map and not the other. "On this day" lists events Wikidata dates to today's day in the Gregorian calendar, years
  confirmed by their articles. The journal remembers places, eras and articles in this browser only.
- **Cities**: 949 major cities drawn by the populations recorded on Wikidata (censuses and official
  estimates), interpolated only between figures at most 60 years apart and never extrapolated.
- **Languages**: the reader, hover cards and films follow the browser language (20 languages, or
  the reader's picker) through Wikipedia's interlanguage links, falling back to English with a
  note. The rest of the interface is in English.
- **Share links**: `#t=1789.54&at=2.369,48.853&read=Storming_of_the_Bastille` opens that year,
  place and article.
- **Reader**: every dated event (304) has a hand-picked Wikipedia article
  (`scripts/build-data/curated/event-articles.mjs`, checked by `articles.mjs`). The History tab
  shows its whole lead plus *Background* and *Aftermath*/*Legacy*. Every link in it gets a hover
  card: a short film on top, the definition below. The film is cut only from the real pictures the
  article itself uses (portraits, paintings, photos, documents), with Ken Burns moves, captions,
  grain, an old-stock grade on pictures dated before 1900, and the person's real signature from
  Wikidata as the last shot. Nothing is generated: an AI-made "Jefferson" would be an invented fact.
- **Honesty**: every dated fact has a confidence (documented / estimated / disputed) shown as "c.",
  "est." or a "disputed" tag. When the border data carries a name past its time (for example "Sui
  Empire" in 700 CE), the dated lineage wins.

## Data sources and credits

Every source was checked on 2026-10-28. The globe, borders, panel and data are precomputed into
`public/`. The one exception is the reader: article text, hover-card definitions and film pictures
are fetched by the browser from Wikipedia (en.wikipedia.org, upload.wikimedia.org, wikidata.org)
when someone opens or hovers them, so any link in any article works. If Wikipedia can't be reached,
the reader says so and everything else keeps working.

| Data | Source | Licence |
|---|---|---|
| Day texture | NASA Visible Earth, Blue Marble Next Generation (topography + bathymetry, Dec 2004), record 73909 | Public domain (NASA) |
| Night lights | NASA Black Marble 2016, record 144898 | Public domain (NASA) |
| Clouds | NASA Visible Earth, record 57747 | Public domain (NASA) |
| Elevation and bathymetry (sea-level changes) | GEBCO 08 via NASA Visible Earth, records 73934 / 73963 | GEBCO terms (free with attribution) |
| Country polygons | Natural Earth via [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 | Public domain / ISC |
| Plate reconstructions | [GPlates Web Service](https://gws.gplates.org), model MERDITH2021: Merdith et al. (2021), *Earth-Science Reviews* 214 | CC BY 4.0 |
| Borders 3400 BCE–1885 | [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) v0.2.1: Bennett et al. (2025), *Scientific Data* 12, doi:10.1038/s41597-025-04516-9; Seshat Global History Databank. Changed here: simplified below 3 km, split into eras, groupings kept as labels | CC BY 4.0 |
| Historical borders before 3400 BCE, and peoples where Cliopatria has no state | [historical-basemaps](https://github.com/aourednik/historical-basemaps) by André Ourednik et al., kept at source detail down to 1 km | **GPL-3.0** (see note) |
| Borders 1886–today | [CShapes 2.0](https://icr.ethz.ch/data/cshapes/): Schvitz, Girardin, Rüegger, Weidmann, Cederman & Gleditsch (2022), *Journal of Conflict Resolution* 66(1); simplified only below 200 m | **CC BY-NC-SA 4.0** (non-commercial; see note) |
| Independence dates (naming CShapes units) | [Gleditsch & Ward](http://ksgleditsch.com/statelist.html) list of independent states and microstates | cited |
| City populations | Wikidata (P1082 with P585 dates), as recorded | CC0 |
| Located events ("Here" tab) | Wikidata (coordinates P625, dates P585/P580), years confirmed against each Wikipedia article in the browser | CC0 / CC BY-SA 4.0 |
| Country facts | [mledoze/countries](https://github.com/mledoze/countries) | ODbL |
| Population | [Our World in Data](https://ourworldindata.org/population-sources), HYDE 3.2 + UN WPP | CC BY 4.0 |
| Entity summaries | Wikipedia REST summary API | CC BY-SA 4.0 (linked per entity) |
| Reader articles, definitions | English Wikipedia (parse, REST summary and media-list APIs), fetched live | CC BY-SA 4.0 (credited and linked in every card) |
| Film pictures and signatures | Wikimedia Commons, via the article's own images and Wikidata P109 | per file (each frame links to its Commons page) |
| Entity IDs | Wikidata (QIDs via Wikipedia page props) | CC0 |
| LGM sea level | rounded from Spratt & Lisiecki (2016) | cited |
| LGM ice extent | hand-drawn approximation after Dyke (2004), Hughes et al. (2016) | — |
| Green Sahara timing | deMenocal & Tierney (2012), *Nature Education Knowledge*; Shanahan et al. (2015), *Nature Geoscience* 8; extent drawn approximately | cited |
| Axial tilt | Laskar (1986) obliquity polynomial (IAU) | cited |
| Trade routes | waypoints and years of use from each route's Wikipedia article; enslaved Africans figure from the Trans-Atlantic Slave Trade Database | cited |
| Ancient landscapes 0–540 Ma | [PALEOMAP PaleoDEMs](https://zenodo.org/records/5460860): Scotese & Wright (2018); converted to 1° WebP maps | CC BY 4.0 |
| Plates 0–540 Ma | PALEOMAP (Scotese 2016) via the GPlates Web Service | cited |
| Land elevation (relief) | GEBCO 08 via NASA Visible Earth, record 73934 | GEBCO terms (free with attribution) |
| Close-up imagery | [NASA GIBS](https://earthdata.nasa.gov/gibs), Blue Marble Next Generation, streamed | Public domain (NASA) |
| Close-up terrain | [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen / AWS open data: SRTM, GMTED2010, ETOPO1, NED and others), streamed, credited on screen | Attribution per source |
| Stars | Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991, NASA ADC / Harvard) | Public domain |
| Moon | NASA LRO LROC colour map (NASA SVS 4720) | Public domain (NASA) |
| Sun and Moon positions, precession | Meeus, *Astronomical Algorithms* (2nd ed.); IAU general precession | cited |
| Fonts | Inter, Instrument Serif (Google Fonts) | OFL |

**Licence note:** CShapes 2.0 is CC BY-NC-SA 4.0, so while `public/data/history/cshapes.topo.json` is
included the atlas must not be used commercially (no sales, no ads), and adaptations of that file must
be shared under the same licence. It is a separate file from the GPL border data below; if the
project licence or any commercial use is ever considered, check the combination with a lawyer.

historical-basemaps is GPL-3.0. The simplified border files in
`public/data/history/` are derived from it and must stay under GPL-3.0 when redistributed. Decide on
the project licence with that in mind.

### Notes on sources that changed

- **REST Countries** v1–v4 now return "deprecated", and v5 needs an API key. We use
  `mledoze/countries`, the open dataset REST Countries was built on, plus OWID for population.
- `gws.gplates.org/info/model_names` returns 404, but `reconstruct_points` with `MERDITH2021` works.
- The Blue Marble link used in many tutorials (record 74418) returns 404; record 73909 works.
- **KTX2**: not used. Textures ship as WebP (lossless for data textures) with 2k mobile variants, decoded off the main thread with `createImageBitmap`; KTX2's lossy block compression would disturb the sea-level data channels.

## Coverage

Three tiers, shown honestly in the panel:

- **Tier 1, curated**: dated lineages with rulers, capitals, languages, facts and events for
  26 present-day countries. Rich slice regions: Armenia and the Caucasus, the Mediterranean, China,
  Mesoamerica, the British Isles. Major powers: Persia/Iran, Mesopotamia/Iraq, Anatolia/Turkey,
  Russia, India, Japan, both Koreas, the caliphates and Arabia, Spain, France, Germany, Peru, Mali
  and the Mongols, plus the United States.
- **Tier 2, automated**: every present-day country, identified on Wikidata by ISO code, with its
  predecessor states two steps back. Modern facts only appear after today's state began.
- **Tier 3, automated**: every other name in the border data, matched to Wikipedia and Wikidata and
  validated by class, dates and location. Generic labels such as "Savanna hunter-gatherers" are
  deliberately left unmatched rather than tied to a loosely related article.

- **Country events**: every present-day country's History tab lists its most widely covered wars,
  battles, sieges, treaties, revolutions, coups, rebellions, declarations of independence,
  assassinations, massacres, genocides, famines, epidemics, earthquakes and eruptions, from
  Wikidata (`country-events.mjs`). Titles are the Wikipedia article titles word for word and dates
  come straight from Wikidata, so nothing is paraphrased; each one opens its article in the reader.

### Fact checking

`node scripts/qa/fact-check.mjs` checks what the atlas states against Wikidata and the articles it
cites, and writes every disagreement to `scripts/reports/fact-check.json` for review by hand:
event years (Wikidata dates or the article's lead), entity spans (inception and dissolution),
reigns that fall outside the ruler's lifetime, and raw Wikidata ids where a name should be.
Language shares are only shown where a census backs them (the Russian Empire's 1897 census);
elsewhere the panel lists the languages without inventing percentages.

Rebuild order: `entities.mjs` (curated), then `tiers.mjs` (automated), then `country-events.mjs`
and `articles.mjs`. Reports in `scripts/reports/`:
`tier3-decisions.json` (every match with its evidence) and `unmatched-basemap-names.json` (the work
list).
