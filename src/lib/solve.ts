import { boatSpeed, type PreparedPolar } from "./polar.ts"

const DEG = Math.PI / 180

export const norm360 = (a: number) => ((a % 360) + 360) % 360

/** Signed difference a − b in (−180, 180]. */
export const angleDiff = (a: number, b: number) => {
  const d = norm360(a - b)
  return d > 180 ? d - 360 : d
}

export type Tack = "starboard" | "port" | "head" | "dead-run"

export interface CourseSample {
  heading: number
  /** Signed true wind angle: positive when the wind comes over starboard. */
  twa: number
  bsp: number
  vmc: number
}

export interface Band {
  from: CourseSample
  to: CourseSample
}

export interface Solution {
  best: CourseSample
  otherTack: CourseSample | null
  direct: CourseSample | null
  threshold: number
  bands: Band[]
  /** Speed toward the destination the other tack's margin keeps; null without a usable other tack. */
  otherThreshold: number | null
  /** Headings on the other tack within the margin of its own best. Empty when the main bands already cover that tack's best. */
  otherBands: Band[]
  /**
   * Destination bearings, clockwise from `from` to `to`, for which the best heading stays within the margin
   * of that destination's own best. Includes the current destination.
   */
  destinationRange: { from: number; to: number }
  samples: (CourseSample | null)[]
}

export interface SolveInput {
  polar: PreparedPolar
  tws: number
  windFrom: number
  destination: number
  margin: number
  step?: number
}

export function tackOf(twa: number): Tack {
  if (Math.abs(twa) < 1e-6) return "head"
  if (Math.abs(Math.abs(twa) - 180) < 1e-6) return "dead-run"
  return twa > 0 ? "starboard" : "port"
}

function sampleAt(input: SolveInput, heading: number): CourseSample | null {
  const twa = angleDiff(input.windFrom, heading)
  const bsp = boatSpeed(input.polar, twa, input.tws)
  if (bsp === null) return null
  const vmc = bsp * Math.cos((heading - input.destination) * DEG)
  return { heading: norm360(heading), twa, bsp, vmc }
}

/** Runs of consecutive samples that pass the test, joined across north. */
function findBands(samples: (CourseSample | null)[], test: (s: CourseSample) => boolean): Band[] {
  const count = samples.length
  const inBand = samples.map((s) => !!s && test(s))
  const bands: Band[] = []
  const start = inBand.indexOf(false)
  if (start === -1) return [{ from: samples[0]!, to: samples[count - 1]! }]
  let runStart = -1
  for (let k = 1; k <= count; k++) {
    const i = (start + k) % count
    if (inBand[i] && runStart === -1) runStart = i
    if (!inBand[i] && runStart !== -1) {
      bands.push({ from: samples[runStart]!, to: samples[(i - 1 + count) % count]! })
      runStart = -1
    }
  }
  return bands
}

/**
 * Walks the destination bearing away from the current one on each side, while `best` keeps at least
 * (1 − margin) of the best speed toward that bearing.
 */
function findDestinationRange(
  samples: (CourseSample | null)[],
  best: CourseSample,
  destination: number,
  margin: number,
  step: number,
): { from: number; to: number } {
  // Boat velocity components per heading, so the speed toward any bearing is one dot product.
  const vx: number[] = []
  const vy: number[] = []
  for (const s of samples) {
    if (!s) continue
    const h = s.heading * DEG
    vx.push(s.bsp * Math.cos(h))
    vy.push(s.bsp * Math.sin(h))
  }
  const holds = (bearing: number) => {
    const dx = Math.cos(bearing * DEG)
    const dy = Math.sin(bearing * DEG)
    let top = 0
    for (let i = 0; i < vx.length; i++) top = Math.max(top, vx[i] * dx + vy[i] * dy)
    const ours = best.bsp * Math.cos((best.heading - bearing) * DEG)
    return top > 0 && ours >= top * (1 - margin) - 1e-9
  }
  const reach = (dir: 1 | -1) => {
    let d = 0
    while (d + step < 180 && holds(destination + dir * (d + step))) d += step
    return d
  }
  return { from: norm360(destination - reach(-1)), to: norm360(destination + reach(1)) }
}

export function solve(input: SolveInput): Solution | null {
  const step = input.step ?? 0.1
  const count = Math.round(360 / step)
  const samples: (CourseSample | null)[] = []
  let best: CourseSample | null = null
  for (let i = 0; i < count; i++) {
    const s = sampleAt(input, i * step)
    samples.push(s)
    if (s && (!best || s.vmc > best.vmc)) best = s
  }
  if (!best || best.vmc <= 0) return null

  const bestSide = Math.sign(best.twa)
  let otherTack: CourseSample | null = null
  for (const s of samples) {
    // Always one option per tack, even if it's where the tacks meet or makes no progress.
    if (!s || Math.sign(s.twa) !== -bestSide || bestSide === 0) continue
    if (!otherTack || s.vmc > otherTack.vmc) otherTack = s
  }

  const threshold = best.vmc * (1 - input.margin)
  const bands = findBands(samples, (s) => s.vmc >= threshold)

  // A margin only means something when the other tack makes progress.
  const otherThreshold = otherTack && otherTack.vmc > 1e-9 ? otherTack.vmc * (1 - input.margin) : null
  const otherBands =
    otherTack && otherThreshold !== null && otherTack.vmc < threshold
      ? findBands(samples, (s) => Math.sign(s.twa) === -bestSide && s.vmc > 0 && s.vmc >= otherThreshold)
      : []

  const destinationRange = findDestinationRange(samples, best, input.destination, input.margin, step)

  return {
    best,
    otherTack,
    direct: sampleAt(input, input.destination),
    threshold,
    bands,
    otherThreshold,
    otherBands,
    destinationRange,
    samples,
  }
}
