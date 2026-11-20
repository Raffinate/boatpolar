export interface PolarCurve {
  tws: number
  twa: number[]
  bsp: number[]
}

export interface Polar {
  id: string
  name: string
  source?: string
  curves: PolarCurve[]
}

export interface PreparedCurve {
  tws: number
  minTwa: number
  maxTwa: number
  at(twa: number): number | null
}

export interface PreparedPolar {
  polar: Polar
  curves: PreparedCurve[]
  minTws: number
  maxTws: number
  maxBsp: number
}

// Fritsch–Carlson monotone cubic slopes: smooth like a spline, but never overshoots the data,
// so the curve can't invent speed peaks between measured angles.
function pchipSlopes(x: number[], y: number[]): number[] {
  const n = x.length
  const h: number[] = []
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) {
    h.push(x[i + 1] - x[i])
    d.push((y[i + 1] - y[i]) / h[i])
  }
  const m = new Array<number>(n).fill(0)
  if (n === 2) {
    m[0] = m[1] = d[0]
    return m
  }
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue
    const w1 = 2 * h[i] + h[i - 1]
    const w2 = h[i] + 2 * h[i - 1]
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
  }
  const end = (h0: number, h1: number, d0: number, d1: number) => {
    let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1)
    if (Math.sign(s) !== Math.sign(d0)) s = 0
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > Math.abs(3 * d0)) s = 3 * d0
    return s
  }
  m[0] = end(h[0], h[1], d[0], d[1])
  m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3])
  return m
}

export function prepareCurve(curve: PolarCurve): PreparedCurve {
  const x = curve.twa
  const y = curve.bsp
  const n = x.length
  const m = n >= 2 ? pchipSlopes(x, y) : [0]
  return {
    tws: curve.tws,
    minTwa: x[0],
    maxTwa: x[n - 1],
    at(twa) {
      if (twa < x[0] - 1e-9 || twa > x[n - 1] + 1e-9) return null
      if (n === 1) return y[0]
      let lo = 0
      let hi = n - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (x[mid] <= twa) lo = mid
        else hi = mid
      }
      const h = x[hi] - x[lo]
      const t = Math.min(1, Math.max(0, (twa - x[lo]) / h))
      const t2 = t * t
      const t3 = t2 * t
      const v =
        (2 * t3 - 3 * t2 + 1) * y[lo] +
        (t3 - 2 * t2 + t) * h * m[lo] +
        (-2 * t3 + 3 * t2) * y[hi] +
        (t3 - t2) * h * m[hi]
      return Math.max(0, v)
    },
  }
}

export function preparePolar(polar: Polar): PreparedPolar {
  const curves = [...polar.curves].sort((a, b) => a.tws - b.tws).map(prepareCurve)
  let maxBsp = 0
  for (const c of polar.curves) for (const v of c.bsp) maxBsp = Math.max(maxBsp, v)
  return {
    polar,
    curves,
    minTws: curves[0].tws,
    maxTws: curves[curves.length - 1].tws,
    maxBsp,
  }
}

/** Boat speed for a true wind angle (either side, degrees) and true wind speed, linear between wind speed curves. */
export function boatSpeed(p: PreparedPolar, twa: number, tws: number): number | null {
  const a = Math.abs(twa) > 180 ? 360 - Math.abs(twa) : Math.abs(twa)
  const curves = p.curves
  if (tws <= curves[0].tws) return curves[0].at(a)
  const last = curves[curves.length - 1]
  if (tws >= last.tws) return last.at(a)
  let i = 0
  while (curves[i + 1].tws < tws) i++
  const c0 = curves[i]
  const c1 = curves[i + 1]
  const v0 = c0.at(a)
  const v1 = c1.at(a)
  if (v0 === null || v1 === null) return null
  const f = (tws - c0.tws) / (c1.tws - c0.tws)
  return v0 + (v1 - v0) * f
}

export function normalizePolar(polar: Polar): Polar {
  const curves = polar.curves
    .map((c) => {
      const pairs = c.twa
        .map((twa, i) => [twa, c.bsp[i]] as const)
        .filter(([a, v]) => Number.isFinite(a) && Number.isFinite(v) && a >= 0 && a <= 180 && v >= 0)
        .sort((x, y) => x[0] - y[0])
      const twa: number[] = []
      const bsp: number[] = []
      for (const [a, v] of pairs) {
        if (twa.length && Math.abs(twa[twa.length - 1] - a) < 1e-6) {
          bsp[bsp.length - 1] = v
          continue
        }
        twa.push(a)
        bsp.push(v)
      }
      return { tws: c.tws, twa, bsp }
    })
    .filter((c) => Number.isFinite(c.tws) && c.tws > 0 && c.twa.length >= 2)
    .sort((a, b) => a.tws - b.tws)
  const unique: PolarCurve[] = []
  for (const c of curves) if (!unique.length || unique[unique.length - 1].tws !== c.tws) unique.push(c)
  return { ...polar, curves: unique }
}
