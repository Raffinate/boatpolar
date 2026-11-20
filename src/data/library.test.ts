import { readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { catalog } from "./catalog.ts"
import { library } from "./library.ts"

describe("polar library", () => {
  it("has a file for every catalog entry and an entry for every file", () => {
    const files = readdirSync(new URL("./polars/", import.meta.url))
      .filter((f) => f.endsWith(".pol"))
      .map((f) => f.slice(0, -4))
      .sort()
    expect(files).toEqual(catalog.map((c) => c.id).sort())
    expect(new Set(catalog.map((c) => c.id)).size).toBe(catalog.length)
  })

  it.each(library.map((b) => [b.id, b] as const))("%s is complete and smooth", (_, boat) => {
    const curves = boat.polar.curves
    expect(curves.length).toBeGreaterThanOrEqual(5)
    for (const c of curves) {
      expect(c.twa[0]).toBeLessThanOrEqual(55)
      expect(c.twa[c.twa.length - 1]).toBeGreaterThanOrEqual(140)
      if (c.tws > 30) continue
      const pts = c.twa.map((a, i) => [a, c.bsp[i]]).filter(([a, v]) => a >= 30 && v > 0)
      for (let k = 1; k < pts.length - 1; k++) {
        const [a0, v0] = pts[k - 1]
        const [a1, v1] = pts[k]
        const [a2, v2] = pts[k + 1]
        const linear = v0 + ((v2 - v0) * (a1 - a0)) / (a2 - a0)
        expect(Math.abs(v1 - linear) / v1, `${c.tws} kn at ${a1}°`).toBeLessThan(0.12)
      }
    }
  })
})
