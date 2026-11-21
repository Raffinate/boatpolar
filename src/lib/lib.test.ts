import { describe, expect, it } from "vitest"
import { parsePolar } from "./parse.ts"
import { boatSpeed, preparePolar, type Polar } from "./polar.ts"
import { angleDiff, norm360, solve } from "./solve.ts"

const grid = `TWA\\TWS\t6\t10\t16
0\t0\t0\t0
40\t4.0\t5.6\t6.4
52\t5.0\t6.5\t7.2
90\t6.0\t7.5\t8.4
120\t5.8\t7.8\t9.4
150\t4.6\t6.6\t8.8
180\t3.6\t5.6\t7.9`

const parsed = (text: string) => {
  const r = parsePolar(text)
  if (!r.ok) throw new Error(r.error)
  return r
}

describe("parsePolar", () => {
  it("reads a tab-separated TWA \\ TWS grid", () => {
    const r = parsed(grid)
    expect(r.format).toBe("TWA \\ TWS table")
    expect(r.polar.curves.map((c) => c.tws)).toEqual([6, 10, 16])
    expect(r.polar.curves[1].twa).toEqual([0, 40, 52, 90, 120, 150, 180])
    expect(r.polar.curves[1].bsp[3]).toBe(7.5)
  })

  it("reads semicolons with decimal commas", () => {
    const r = parsed(grid.replace(/\t/g, ";").replace(/(\d)\.(\d)/g, "$1,$2"))
    expect(r.polar.curves[2].bsp[4]).toBe(9.4)
  })

  it("reads a transposed TWS \\ TWA table", () => {
    const r = parsed(`TWS\\TWA 45 90 135 180
8 5.1 6.8 6.0 4.2
12 6.0 7.6 7.4 5.9`)
    expect(r.format).toBe("TWS \\ TWA table")
    expect(r.polar.curves[0]).toEqual({ tws: 8, twa: [45, 90, 135, 180], bsp: [5.1, 6.8, 6, 4.2] })
  })

  it("guesses orientation without a label", () => {
    const r = parsed(`x,45,60,90,135
6,4,5,6,5
10,5.5,6.4,7.2,6.8`)
    expect(r.polar.curves.map((c) => c.tws)).toEqual([6, 10])
  })

  it("reads a Sailonline .txt polar with a title line", () => {
    const r = parsed(`Example Boat v2
TWA/TWS\t3\t6\t9
24\t2.1\t4.2\t5.6
90\t5.6\t11.0\t14.0
180\t2.7\t5.4\t7.8
`)
    expect(r.polar.name).toBe("Example Boat v2")
    expect(r.format).toBe("TWA \\ TWS table")
    expect(r.polar.curves[1]).toEqual({ tws: 6, twa: [24, 90, 180], bsp: [4.2, 11, 5.4] })
  })

  it("doesn't take a title with numbers for the header", () => {
    const r = parsed(`J 109 2024
TWA\\TWS 6 10
45 5 6
90 6 7`)
    expect(r.polar.name).toBe("J 109 2024")
    expect(r.polar.curves.map((c) => c.tws)).toEqual([6, 10])
  })

  it("reads Expedition-style wind speed + pairs rows", () => {
    const r = parsed(`!Expedition polar
6\t42\t4.5\t90\t6.1\t150\t4.4
10\t40\t5.8\t90\t7.4\t160\t6.0`)
    expect(r.format).toMatch(/pairs/)
    expect(r.polar.curves[1]).toEqual({ tws: 10, twa: [40, 90, 160], bsp: [5.8, 7.4, 6] })
  })

  it("reads Sailonline XML", () => {
    const r = parsed(`<vpp><tws_splined>0 10 20</tws_splined><twa_splined>0 90 180</twa_splined>
<bs_splined>0 0 0;0 8 12;0 6 10</bs_splined></vpp>`)
    expect(r.format).toBe("Sailonline XML")
    expect(r.polar.curves).toEqual([
      { tws: 10, twa: [0, 90, 180], bsp: [0, 8, 6] },
      { tws: 20, twa: [0, 90, 180], bsp: [0, 12, 10] },
    ])
  })

  it("reads an ORC certificate's allowances", () => {
    const cert = {
      Class: "TEST 40",
      Allowances: {
        WindSpeeds: [8],
        WindAngles: [52, 90, 150],
        R52: [600],
        R90: [480],
        R150: [720],
        Beat: [900],
        BeatAngle: [42],
        Run: [800],
        GybeAngle: [160],
      },
    }
    const r = parsed(JSON.stringify({ rms: [cert] }))
    expect(r.polar.name).toBe("TEST 40")
    const c = r.polar.curves[0]
    expect(c.twa).toEqual([42, 52, 90, 150, 160])
    expect(c.bsp[2]).toBe(7.5)
    expect(c.bsp[0]).toBeCloseTo(4 / Math.cos((42 * Math.PI) / 180), 2)
  })

  it("explains what is wrong", () => {
    expect(parsePolar("")).toEqual({ ok: false, error: "The polar is empty." })
    expect(parsePolar("hello\nworld").ok).toBe(false)
  })
})

describe("polar interpolation", () => {
  const p = preparePolar(parsed(grid).polar)

  it("hits the data points and interpolates between wind speeds", () => {
    expect(boatSpeed(p, 90, 10)).toBeCloseTo(7.5)
    expect(boatSpeed(p, -90, 10)).toBeCloseTo(7.5)
    expect(boatSpeed(p, 90, 8)).toBeCloseTo(6.75)
  })

  it("never overshoots between angles", () => {
    for (let a = 90; a <= 120; a += 0.5) {
      const v = boatSpeed(p, a, 16)!
      expect(v).toBeGreaterThanOrEqual(8.4 - 1e-9)
      expect(v).toBeLessThanOrEqual(9.4 + 1e-9)
    }
  })

  it("returns null outside the polar's angles", () => {
    const narrow = preparePolar({ id: "n", name: "n", curves: [{ tws: 10, twa: [40, 150], bsp: [5, 6] }] })
    expect(boatSpeed(narrow, 30, 10)).toBeNull()
    expect(boatSpeed(narrow, 170, 10)).toBeNull()
  })
})

describe("solve", () => {
  const p = preparePolar(parsed(grid).polar)

  it("sails straight at a beam reach destination", () => {
    const s = solve({ polar: p, tws: 10, windFrom: 0, destination: 90, margin: 0.01 })!
    expect(Math.abs(angleDiff(s.best.heading, 90))).toBeLessThan(15)
    expect(s.best.twa).toBeLessThan(0)
    expect(s.direct!.vmc).toBeGreaterThan(s.threshold * 0.95)
  })

  it("splits a dead-upwind destination into two equal tacks", () => {
    const s = solve({ polar: p, tws: 10, windFrom: 0, destination: 0, margin: 0.01 })!
    expect(s.otherTack).not.toBeNull()
    expect(s.otherTack!.vmc).toBeCloseTo(s.best.vmc, 3)
    expect(Math.abs(s.best.twa)).toBeCloseTo(Math.abs(s.otherTack!.twa), 0)
    expect(s.bands).toHaveLength(2)
    expect(s.direct!.vmc).toBe(0)
  })

  it("keeps the band inside the margin", () => {
    const s = solve({ polar: p, tws: 12, windFrom: 220, destination: 200, margin: 0.02 })!
    for (const b of s.bands) {
      expect(b.from.vmc).toBeGreaterThanOrEqual(s.threshold)
      expect(b.to.vmc).toBeGreaterThanOrEqual(s.threshold)
    }
    expect(s.threshold).toBeCloseTo(s.best.vmc * 0.98)
  })

  it("gives the other tack its own margin band", () => {
    const s = solve({ polar: p, tws: 12, windFrom: 0, destination: 30, margin: 0.02 })!
    expect(s.otherTack!.vmc).toBeLessThan(s.threshold)
    expect(s.otherThreshold).toBeCloseTo(s.otherTack!.vmc * 0.98)
    expect(s.otherBands.length).toBeGreaterThan(0)
    for (const b of s.otherBands) {
      expect(Math.sign(b.from.twa)).toBe(-Math.sign(s.best.twa))
      expect(Math.sign(b.to.twa)).toBe(-Math.sign(s.best.twa))
      expect(b.from.vmc).toBeGreaterThanOrEqual(s.otherThreshold!)
      expect(b.to.vmc).toBeGreaterThanOrEqual(s.otherThreshold!)
    }
    const span = norm360(s.otherBands[0].to.heading - s.otherBands[0].from.heading)
    expect(norm360(s.otherTack!.heading - s.otherBands[0].from.heading)).toBeLessThanOrEqual(span)
  })

  it("leaves the other tack to the main band when it's within the margin of best", () => {
    const s = solve({ polar: p, tws: 10, windFrom: 0, destination: 0, margin: 0.01 })!
    expect(s.otherBands).toHaveLength(0)
  })

  it("handles a band that wraps through north", () => {
    const polar: Polar = { id: "w", name: "w", curves: [{ tws: 10, twa: [0, 180], bsp: [6, 6] }] }
    const s = solve({ polar: preparePolar(polar), tws: 10, windFrom: 90, destination: 0, margin: 0.01 })!
    expect(s.bands).toHaveLength(1)
    expect(s.bands[0].from.heading).toBeGreaterThan(350)
    expect(s.bands[0].to.heading).toBeLessThan(10)
  })
})
