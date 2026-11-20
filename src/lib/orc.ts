import type { PolarCurve } from "./polar.ts"

/** The `Allowances` block of an ORC certificate from data.orc.org: seconds per mile at each wind speed. */
export interface OrcAllowances {
  WindSpeeds: number[]
  WindAngles: number[]
  BeatAngle: number[]
  GybeAngle: number[]
  Beat: number[]
  Run: number[]
  [key: string]: number[]
}

/** The `vpp` block used by jieter/orc-data: boat speeds in knots. */
export interface OrcDataVpp {
  angles: number[]
  speeds: number[]
  beat_angle: number[]
  beat_vmg: number[]
  run_angle: number[]
  run_vmg: number[]
  [key: string]: number[]
}

const rad = (deg: number) => (deg * Math.PI) / 180

function buildCurve(
  tws: number,
  angles: number[],
  speedAt: (angle: number) => number | undefined,
  beatAngle: number | undefined,
  beatVmg: number | undefined,
  runAngle: number | undefined,
  runVmg: number | undefined,
): PolarCurve {
  const points: [number, number][] = []
  if (beatAngle && beatVmg && beatAngle > 0 && beatAngle < 90) {
    points.push([beatAngle, beatVmg / Math.cos(rad(beatAngle))])
  }
  for (const a of angles) {
    const v = speedAt(a)
    if (v !== undefined && Number.isFinite(v) && v > 0) points.push([a, v])
  }
  if (runAngle && runVmg && runAngle > 90 && runAngle <= 180) {
    points.push([runAngle, runVmg / Math.cos(rad(180 - runAngle))])
  }
  points.sort((a, b) => a[0] - b[0])
  const twa: number[] = []
  const bsp: number[] = []
  for (const [a, v] of points) {
    if (twa.length && Math.abs(twa[twa.length - 1] - a) < 0.05) continue
    twa.push(Math.round(a * 10) / 10)
    bsp.push(Math.round(v * 100) / 100)
  }
  return { tws, twa, bsp }
}

const fromAllowance = (secondsPerMile: number | undefined) =>
  secondsPerMile && secondsPerMile > 0 ? 3600 / secondsPerMile : undefined

export function curvesFromOrcAllowances(a: OrcAllowances): PolarCurve[] {
  return a.WindSpeeds.map((tws, j) =>
    buildCurve(
      tws,
      a.WindAngles,
      (angle) => fromAllowance(a[`R${angle}`]?.[j]),
      a.BeatAngle?.[j],
      fromAllowance(a.Beat?.[j]),
      a.GybeAngle?.[j],
      fromAllowance(a.Run?.[j]),
    ),
  )
}

export function curvesFromOrcDataVpp(v: OrcDataVpp): PolarCurve[] {
  return v.speeds.map((tws, j) =>
    buildCurve(
      tws,
      v.angles,
      (angle) => v[String(angle)]?.[j],
      v.beat_angle?.[j],
      v.beat_vmg?.[j],
      v.run_angle?.[j],
      v.run_vmg?.[j],
    ),
  )
}
