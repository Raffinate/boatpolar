import { normalizePolar, type Polar, type PolarCurve } from "./polar.ts"

const SETTINGS_KEY = "boatpolarsolver:settings:v1"
const POLAR_KEY = "boatpolarsolver:polar:v1"
const CUSTOM_KEY = "boatpolarsolver:custom:v1"

export interface Settings {
  windFrom: number
  tws: number
  destination: number
  marginPct: number
  view: "north" | "wind"
}

export type SavedPolar = { boatId: string } | { custom: Polar }

const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined

export function parseSettings(raw: unknown): Partial<Settings> {
  if (!raw || typeof raw !== "object") return {}
  const r = raw as Record<string, unknown>
  const out: Partial<Settings> = {}
  const windFrom = finite(r.windFrom, 0, 359)
  const tws = finite(r.tws, 0, 100)
  const destination = finite(r.destination, 0, 359)
  const marginPct = finite(r.marginPct, 0, 10)
  if (windFrom !== undefined) out.windFrom = windFrom
  if (tws !== undefined) out.tws = tws
  if (destination !== undefined) out.destination = destination
  if (marginPct !== undefined) out.marginPct = marginPct
  if (r.view === "north" || r.view === "wind") out.view = r.view
  return out
}

export function parsePolarSetting(raw: unknown): SavedPolar | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.boatId === "string") return { boatId: r.boatId }
  const c = r.custom as Record<string, unknown> | undefined
  if (!c || typeof c.name !== "string" || !Array.isArray(c.curves)) return null
  const curves = (c.curves as Record<string, unknown>[]).filter(
    (x): x is Record<string, unknown> & PolarCurve =>
      !!x && typeof x.tws === "number" && Array.isArray(x.twa) && Array.isArray(x.bsp),
  )
  const polar = normalizePolar({
    id: typeof c.id === "string" ? c.id : `custom:${c.name}`,
    name: c.name,
    curves: curves.map((x) => ({ tws: x.tws, twa: x.twa.map(Number), bsp: x.bsp.map(Number) })),
  })
  return polar.curves.length ? { custom: polar } : null
}

function read(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be full or blocked (private windows); the page works without it.
  }
}

export function parseCustomPolars(raw: unknown): Polar[] {
  if (!Array.isArray(raw)) return []
  const out: Polar[] = []
  for (const item of raw) {
    const saved = parsePolarSetting({ custom: item })
    if (saved && "custom" in saved && !out.some((p) => p.id === saved.custom.id)) out.push(saved.custom)
  }
  return out
}

const sameCurves = (a: Polar, b: Polar) => JSON.stringify(a.curves) === JSON.stringify(b.curves)

/** Adds a polar to the list; the same polar again is a no-op, a different one with a taken name gets "(2)", "(3)"… */
export function addCustomPolar(list: Polar[], polar: Polar): { list: Polar[]; polar: Polar } {
  const base = polar.name.trim() || "Custom polar"
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} (${n})`
    const existing = list.find((p) => p.name === name)
    if (existing && sameCurves(existing, polar)) return { list, polar: existing }
    if (!existing) {
      const added: Polar = { id: `custom:${name}`, name, curves: polar.curves }
      return { list: [...list, added], polar: added }
    }
  }
}

export const loadSettings = () => parseSettings(read(SETTINGS_KEY))
export const loadCustomPolars = () => parseCustomPolars(read(CUSTOM_KEY))
export const saveCustomPolars = (list: Polar[]) => write(CUSTOM_KEY, list)
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)
export const loadPolarSetting = () => parsePolarSetting(read(POLAR_KEY))
export const savePolarSetting = (p: SavedPolar) => write(POLAR_KEY, p)
