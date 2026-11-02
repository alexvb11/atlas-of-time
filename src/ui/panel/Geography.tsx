import { useTime } from '../../time/store'
import { tr } from '../../i18n'
import type { EntityIndex } from '../../data/entities'
import type { Resolution } from '../../data/resolve'
import { Stat } from './bits'
import { periodAt } from '../../time/eras'
import { seaLevelAt } from '../../time/climate'
import { driftedPosition } from '../../scene/selectionTrack'
import { vec3ToLonLat } from '../../geo/sphere'
import { formatNumber } from '../../time/format'
import { toMa } from '../../time/scale'

const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`
const fmtLon = (lon: number) => `${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? 'E' : 'W'}`

function band(lat: number) {
  const a = Math.abs(lat)
  if (a < 12) return 'near the equator'
  if (a < 30) return 'in the tropics'
  if (a < 45) return 'in the subtropics'
  if (a < 62) return 'in the mid-latitudes'
  return 'close to the pole'
}

export function GeographyTab({ res, idx }: { res: Resolution; idx: EntityIndex }) {
  const t = useTime((s) => s.time)
  const sel = useTime((s) => s.selection)!
  const country = 'country' in res ? res.country : null
  const period = periodAt(t)

  if (res.kind === 'deep') {
    const p = driftedPosition(sel)
    const then = p ? vec3ToLonLat(p) : null
    return (
      <div className="space-y-3">
        <p className="text-[13.5px] leading-relaxed text-ink/85">
          {then ? (
            <>
              In the {period?.name ?? 'deep past'}, {toMa(t).toFixed(0)} million years ago, this land sat {band(then[1])}
              {period?.life ? `. ${period.life}.` : '.'}
            </>
          ) : (
            'This point is not on reconstructed continental crust; the ocean floor here is younger or has since been recycled.'
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {then && <Stat label="Latitude then">{fmtLat(then[1])}</Stat>}
          <Stat label="Latitude now">{fmtLat(sel[1])}</Stat>
          {period && <Stat label="Period">{period.name}</Stat>}
          {period?.climate && <Stat label="Global climate">{period.climate}</Stat>}
          <Stat label="Landmass" wide>{res.title}</Stat>
          {country && <Stat label="Today part of" wide>{country.flag} {country.name}</Stat>}
        </div>
        <p className="text-[11px] text-dim italic">Positions from the Merdith et al. (2021) plate model via GPlates. Coastlines shown are today's, carried back in time.</p>
      </div>
    )
  }

  const sea = seaLevelAt(t)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Location">{fmtLat(sel[1])}, {fmtLon(sel[0])}</Stat>
        <Stat label="Latitude band">{band(sel[1]).replace(/^\w/, (c) => c.toUpperCase())}</Stat>
        {country && (
          <>
            <Stat label="Region">{country.subregion || country.region}</Stat>
            <Stat label="Area today"><span className="tnum">{formatNumber(country.area)}</span> km²</Stat>
            <Stat label="Coast">{tr(country.landlocked ? 'Landlocked' : 'Has a coastline')}</Stat>
          </>
        )}
        {Math.abs(sea) > 8 && (
          <Stat label="Sea level" wide>
            ~{Math.abs(Math.round(sea))} m {sea < 0 ? 'lower' : 'higher'} than today
            <span className="text-dim"> (estimated)</span>
            {sea < -60 && <div className="mt-0.5 text-[12px] text-mist">Land bridges such as Beringia and Doggerland are exposed.</div>}
          </Stat>
        )}
      </div>
      {country && country.borders.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-[0.18em] text-dim uppercase">{tr('Neighbours today')}</h3>
          <div className="flex flex-wrap gap-1.5">
            {country.borders.map((iso) => {
              const n = idx.countries.get(iso)
              if (!n) return null
              return (
                <button
                  key={iso}
                  type="button"
                  className="bubble px-3 py-1.5 text-[12px] text-ink"
                  onClick={() => {
                    useTime.getState().select([n.latlng[1], n.latlng[0]])
                  }}
                >
                  <span className="mr-1">{n.flag}</span>
                  {n.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
