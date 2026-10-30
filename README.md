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

### Quality checks

These need the dev server running.

```bash
npm run qa:shots   # screenshot tour of major states → scripts/qa/shots
npm run qa:audit   # 20 random dates × 5 places: does every visible element agree with the date?
npm run qa:fps     # frame rate idle / scrubbing / panel open (real GPU via headless Chromium)
node scripts/qa/perf.mjs "http://localhost:4173/?qa" --mobile --slow   # cold load + first scrub on a production build (phone CPU, slow 4G)
node scripts/qa/a11y.mjs   # touch targets, focus indicators, Escape
node scripts/qa/reader.mjs [--mobile]   # History dropdown → hover card → reader → signature (needs network)
```

## Controls

| Action | Input |
|---|---|
| Rotate / zoom | drag, wheel, pinch |
| Select a place | click (deep time: click the drifting land itself) |
| Deselect | Esc or click empty space |
| Move through time | drag the time bar, ← / → nudge, Shift+← / → jump eras, Space play/pause |
| Flip film pictures | ‹ › buttons, or ← / → while pointing at a film or with a hover card open |
| Search | ⌘K / Ctrl+K |
| Read an event | History tab: click the title (the year jumps the slider) · event cards: *Read the story* |
| Look something up | hover (or focus, or tap) an underlined name; click it to read on, Back walks the trail |

## How it works

See [PLAN.md](PLAN.md) for the architecture. Short version:

- **Time axis**: astronomical years (1 BCE = 0). The slider maps a segmented, partly logarithmic
  scale onto it, so 600 Ma and 1914 are both easy to reach.
- **Deep time**: today's land and country borders are triangulated once and every vertex is
  reconstructed by GPlates (MERDITH2021) at 101 timesteps (0–750 Ma). Because vertex *i* is the same
  crust in every snapshot, the GPU interpolates positions every frame. Triangles stretched across two
  plates fade out, and crust the model does not place at a given time is shown only as a ghost.
- **Selection is a location**. A click stores a present-day lon/lat; in deep time it rides its
  triangle of crust. At each time it resolves to an entity through dated lineages per present-day
  country, the historical border polygon under it, or regional prehistory. It never shows an empty
  panel.
- **Borders**: before 1886, historical-basemaps snapshots (a few per century), crossfaded near each
  change. From 1886, CShapes 2.0: every territorial change is its own dated snapshot (765 of them),
  assembled in a worker from one shared TopoJSON. CShapes gives a unit one modern name for its whole
  history ("Kenya" from 1888), so `cshapes.mjs` names each piece for its date: independent states by
  the Gleditsch–Ward lists (Russian Empire, Soviet Russia, Soviet Union, Russia), dependencies from a
  dated, hand-checked table (Imperial British East Africa, East Africa Protectorate, Kenya Colony),
  with the ruling power. CShapes moves borders on treaty dates, so a few pieces between the collapse
  of empires and the peace treaties are named for what they were ("Former Austrian crown lands,
  borders until the Treaty of Saint-Germain").
- **Here**: click anywhere and the Here tab lists what happened near that point around that time,
  from about 11,000 located, dated Wikidata events, numbered on the globe. The window scales with
  time (a few years recently, up to 150 years in antiquity), and each year is confirmed against the
  event's Wikipedia lead before it is shown.
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
| Historical borders before 1886 | [historical-basemaps](https://github.com/aourednik/historical-basemaps) by André Ourednik et al., kept at source detail down to 1 km | **GPL-3.0** (see note) |
| Borders 1886–today | [CShapes 2.0](https://icr.ethz.ch/data/cshapes/): Schvitz, Girardin, Rüegger, Weidmann, Cederman & Gleditsch (2022), *Journal of Conflict Resolution* 66(1); simplified only below 200 m | **CC BY-NC-SA 4.0** (non-commercial; see note) |
| Independence dates (naming CShapes units) | [Gleditsch & Ward](http://ksgleditsch.com/statelist.html) list of independent states and microstates | cited |
| Located events ("Here" tab) | Wikidata (coordinates P625, dates P585/P580), years confirmed against each Wikipedia article in the browser | CC0 / CC BY-SA 4.0 |
| Country facts | [mledoze/countries](https://github.com/mledoze/countries) | ODbL |
| Population | [Our World in Data](https://ourworldindata.org/population-sources), HYDE 3.2 + UN WPP | CC BY 4.0 |
| Entity summaries | Wikipedia REST summary API | CC BY-SA 4.0 (linked per entity) |
| Reader articles, definitions | English Wikipedia (parse, REST summary and media-list APIs), fetched live | CC BY-SA 4.0 (credited and linked in every card) |
| Film pictures and signatures | Wikimedia Commons, via the article's own images and Wikidata P109 | per file (each frame links to its Commons page) |
| Entity IDs | Wikidata (QIDs via Wikipedia page props) | CC0 |
| LGM sea level | rounded from Spratt & Lisiecki (2016) | cited |
| LGM ice extent | hand-drawn approximation after Dyke (2004), Hughes et al. (2016) | — |
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
