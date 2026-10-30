# Atlas of Time: plan

## Core principle
`time` (one number in a Zustand store) drives everything on screen. Every layer and panel derives
its state from `time` through pure "what is true at T" queries over pre-sorted indexes (binary
search, < 0.1 ms). Selection is a **location** (present-day lon/lat), never a country.

## Time model
- `time` is an **astronomical year** (1 CE = 1, 1 BCE = 0, 500 BCE = -499). Deep time is the same
  axis: 200 Ma is `PRESENT - 200e6`. One axis means one comparison function for everything.
- Slider position `u ∈ [0,1]` maps to `time` through a segmented, nonlinear scale
  (`src/time/scale.ts`):
  - 0.00–0.30 deep time, 750 Ma → 1 Ma (log of years-before-present)
  - 0.30–0.48 prehistory, 1 Ma → 3000 BCE (log)
  - 0.48–1.00 recorded history, 3000 BCE → today (piecewise linear, denser after 1500 CE)
- `scrubVelocity` (slider units per second, smoothed) drives the time-warp effect.
- Milestones (eras, events) live in sorted arrays; gentle snap on release within 1.2 % of track.

## Rendering (React Three Fiber)
| Layer | How | Time behaviour |
|---|---|---|
| Earth | custom shader: Blue Marble day, Black Marble night, sun terminator, ocean specular from land mask, relief from GEBCO | photo fades out as drift grows; sea level from GEBCO bathymetry; LGM ice mask scaled by ice-age curve; city lights fade in 1850 → 1950, sparse warm historic-city points before |
| Drift land | one mesh, present-day land triangulated + refined; two position attributes (snapshot A/B), shader nlerps on the GPU | positions from GPlates `MERDITH2021`, 0–750 Ma; vertex `i` is the same crust in every snapshot, so motion is continuous and free on the CPU |
| Clouds | sphere shell, slow drift | thinned in deep time |
| Atmosphere | back-face Fresnel shell, sun-aware | constant |
| Stars / nebula | points with parallax + faint procedural nebula sphere | stretch with scrub velocity |
| Borders | historical-basemaps snapshot ≤ T, line segments; crossfade to next | approximate, labelled once in the UI |
| Labels | polity names at polygon pole-of-inaccessibility | from the same snapshot |
| Post | bloom (low), vignette, chromatic aberration ∝ scrub velocity | |

**Assumption / decision:** the drift layer reconstructs *present-day* land and country borders
(the brief's suggestion). This shows modern coastlines in ancient positions, which is the honest
limit of reconstructing today's features. Documented in the UI caption for deep time.

## Selection and entity resolution
1. Click → ray hits the globe → present-day lon/lat `P` stored.
2. In deep time, `P` is mapped to its drift triangle (barycentric) so the highlight and the camera
   follow the crust: `position(T) = Σ wᵢ · vertexᵢ(T)`.
3. Entity at T: point-in-polygon on the current history snapshot → polygon `NAME` →
   `entityId` via `src/data/entities/match.ts` (curated + generated QID matches).
   No polity → prehistoric culture → landmass / supercontinent → geology. Never empty.
4. Lineage: per-region chains (e.g. Urartu → Kingdom of Armenia → … → Republic of Armenia),
   breadcrumb is clickable to jump time.

## Data pipeline (`scripts/build-data`, build-time only; the only live calls are the reader's, to Wikipedia)
| Script | Source (verified 2026-10-28) | Output |
|---|---|---|
| `textures.mjs` | NASA Visible Earth: Blue Marble NG (73909), Black Marble 2016 (144898), clouds (57747), GEBCO 08 elevation + bathymetry (73934/73963); Natural Earth 50m land | `public/textures/*` |
| `drift.mjs` | gws.gplates.org `reconstruct_points`, model `MERDITH2021` (POST, `return_null_points`) | `public/data/drift/*.bin` |
| `history.mjs` | aourednik/historical-basemaps (55 snapshots, 123 000 BCE → 2010) + mapshaper | `public/data/history/*.json` |
| `countries.mjs` | REST Countries v3.1 (`/all?fields=…`, currently redirects to a static file) | `public/data/countries.json` |
| `articles.mjs` | hand-picked event → Wikipedia article map, checked for existence and disambiguation | `public/data/articles.json` |
| `entities` | curated JSON for the vertical slice; Wikidata SPARQL + Wikipedia REST for tiers 2–3 | `public/data/entities/*.json` |

Notes from verification:
- `gws.gplates.org/info/model_names` 404s; models are documented in the GWS docs. `MERDITH2021`
  reconstructs points back past 750 Ma. Null points (crust not yet existing / unassigned) are
  filled with the next-younger snapshot position.
- NASA's Blue Marble `74418` link in common tutorials is 404; `73909` (topo + bathy) works.
- GEBCO bathymetry PNG is 8-bit (~43 m per step), enough for a −120 m ice-age shoreline.
- KTX2: there is no toktx on this machine; textures ship as mozjpeg JPEG/PNG with a 2k mobile
  variant. KTX2 conversion is a documented follow-up.

## Data tiers (phase 6)
| Tier | What | How | Trust signal in UI |
|---|---|---|---|
| 1 | Major powers + slice regions: dated lineages for 26 present-day countries | hand-curated (`scripts/build-data/curated/*.mjs`), Wikipedia/Wikidata for summaries and QIDs | none needed |
| 2 | Every present-day country + its Wikidata predecessors (2 steps) | `tiers.mjs`: ISO code (P297) → Wikidata; P1365/P155 chains; facts gated on `modernFrom` | "assembled automatically" note |
| 3 | Every other border-data polygon name | `tiers.mjs`: hand-checked name map → exact titles → search; accepted only if the Wikidata class is a polity/people/culture, dates overlap and coordinates are near | "matched automatically" note; "c." dates when taken from the maps |

Precedence when several entities claim the same polygon name at time T: curated, then Tier 2, then
Tier 3. Curated lineages replace automated ones for the same country. Province-level entities never
claim imperial polygon names; they apply only through their location-bound lineage.

## File structure
```
src/
  app/        App shell, intro, loading
  scene/      Globe, EarthMaterial, DriftLand, Borders, Atmosphere, Stars, CameraRig, Effects
  time/       store, scale (slider mapping), eras, seaLevel, formatting
  data/       loaders (history, drift), entity resolution, lineage, indexes
  ui/         TimeBar, HUD, Panel (tabs), CommandPalette, Hover label, controls
  shaders/    GLSL
scripts/build-data/
public/data, public/textures
```

## Phases (revised brief)
1. Scaffold, globe, atmosphere, starfield, lighting, camera.
2. Time store, indexes, slider, deep-time drift, time warp.
3. Historical borders, location selection, entity resolution, fly-to.
4. Time-aware panel + lineage + HUD for slice regions (Armenia/Caucasus, Mediterranean, China,
   Mesoamerica, British Isles).
5. Events + markers + routes; sea level & ice.
6. Data expansion tiers 1–3 with unmatched reports.
7. Intro, loading, sound, command palette.
8. Polish + 20-random-date consistency audit.

## Questions deliberately not asked
- Hosting: Vercel static (no server); everything precomputed.
- React 19 / R3F 9 / Tailwind 4 / Vite 8: current stable versions at build time.
