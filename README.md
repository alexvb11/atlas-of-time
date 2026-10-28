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
```

## Controls

| Action | Input |
|---|---|
| Rotate / zoom | drag, wheel, pinch |
| Select a place | click (deep time: click the drifting land itself) |
| Deselect | Esc or click empty space |
| Move through time | drag the time bar, ← / → nudge, Shift+← / → jump eras, Space play/pause |
| Search | ⌘K / Ctrl+K |

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
- **Honesty**: every dated fact has a confidence (documented / estimated / disputed) shown as "c.",
  "est." or a "disputed" tag. When the border data carries a name past its time (for example "Sui
  Empire" in 700 CE), the dated lineage wins.

## Data sources and credits

Every source was checked on 2026-10-28. The live site calls no third-party APIs; everything is
precomputed into `public/`.

| Data | Source | Licence |
|---|---|---|
| Day texture | NASA Visible Earth, Blue Marble Next Generation (topography + bathymetry, Dec 2004), record 73909 | Public domain (NASA) |
| Night lights | NASA Black Marble 2016, record 144898 | Public domain (NASA) |
| Clouds | NASA Visible Earth, record 57747 | Public domain (NASA) |
| Elevation and bathymetry (sea-level changes) | GEBCO 08 via NASA Visible Earth, records 73934 / 73963 | GEBCO terms (free with attribution) |
| Country polygons | Natural Earth via [world-atlas](https://github.com/topojson/world-atlas) 2.0.2 | Public domain / ISC |
| Plate reconstructions | [GPlates Web Service](https://gws.gplates.org), model MERDITH2021: Merdith et al. (2021), *Earth-Science Reviews* 214 | CC BY 4.0 |
| Historical borders | [historical-basemaps](https://github.com/aourednik/historical-basemaps) by André Ourednik et al. | **GPL-3.0** (see note) |
| Country facts | [mledoze/countries](https://github.com/mledoze/countries) | ODbL |
| Population | [Our World in Data](https://ourworldindata.org/population-sources), HYDE 3.2 + UN WPP | CC BY 4.0 |
| Entity summaries | Wikipedia REST summary API | CC BY-SA 4.0 (linked per entity) |
| Entity IDs | Wikidata (QIDs via Wikipedia page props) | CC0 |
| LGM sea level | rounded from Spratt & Lisiecki (2016) | cited |
| LGM ice extent | hand-drawn approximation after Dyke (2004), Hughes et al. (2016) | — |
| Fonts | Inter, Instrument Serif (Google Fonts) | OFL |

**Licence note:** historical-basemaps is GPL-3.0. The simplified border files in
`public/data/history/` are derived from it and must stay under GPL-3.0 when redistributed. Decide on
the project licence with that in mind.

### Notes on sources that changed

- **REST Countries** v1–v4 now return "deprecated", and v5 needs an API key. We use
  `mledoze/countries`, the open dataset REST Countries was built on, plus OWID for population.
- `gws.gplates.org/info/model_names` returns 404, but `reconstruct_points` with `MERDITH2021` works.
- The Blue Marble link used in many tutorials (record 74418) returns 404; record 73909 works.
- **KTX2**: no `toktx` was available, so textures ship as mozjpeg JPEG/PNG with 2k mobile variants.

## Coverage

The vertical slice has rich, curated, dated data:

- **Armenia and the Caucasus**: 19-step lineage from the Areni-1 cave culture to the Republic of
  Armenia, plus Georgia and Azerbaijan anchors.
- **Mediterranean**: Italy, Greece, Egypt.
- **China**: Yangshao to the People's Republic of China.
- **Mesoamerica**: Mexico, including the Maya.
- **British Isles**: Britain and Ireland.

Everywhere else you get the historical polygon name, present-day facts after 1945, regional
prehistory, and deep time.

`scripts/reports/unmatched-basemap-names.json` lists the 2,453 border-data names not yet linked to
an entity. It is the work list for Tier 2/3 expansion.
