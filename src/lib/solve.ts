import { boatSpeed, type PreparedPolar } from "./polar.ts"

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
  const vmc = bsp * Math.cos(((heading - input.destination) * Math.PI) / 180)
  return { heading: norm360(heading), twa, bsp, vmc }
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
    if (!s || s.vmc <= 0 || Math.sign(s.twa) !== -bestSide || bestSide === 0) continue
    if (!otherTack || s.vmc > otherTack.vmc) otherTack = s
  }

  const threshold = best.vmc * (1 - input.margin)
  const inBand = samples.map((s) => !!s && s.vmc >= threshold)
  const bands: Band[] = []
  const start = inBand.indexOf(false)
  if (start === -1) {
    bands.push({ from: samples[0]!, to: samples[count - 1]! })
  } else {
    let runStart = -1
    for (let k = 1; k <= count; k++) {
      const i = (start + k) % count
      if (inBand[i] && runStart === -1) runStart = i
      if (!inBand[i] && runStart !== -1) {
        bands.push({ from: samples[runStart]!, to: samples[(i - 1 + count) % count]! })
        runStart = -1
      }
    }
  }

  return {
    best,
    otherTack,
    direct: sampleAt(input, input.destination),
    threshold,
    bands,
    samples,
  }
}
