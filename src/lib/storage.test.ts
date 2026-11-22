import { describe, expect, it } from "vitest"
import type { Polar } from "./polar.ts"
import { addCustomPolar, parseCustomPolars, parsePolarSetting, parseSettings } from "./storage.ts"
import { resolveTheme } from "./theme.ts"

const polarOf = (name: string, speed: number): Polar => ({
  id: `custom:${name}`,
  name,
  curves: [{ tws: 10, twa: [45, 90], bsp: [speed, speed + 2] }],
})

describe("custom polars", () => {
  it("adds a new polar", () => {
    const { list, polar } = addCustomPolar([], polarOf("Mine", 5))
    expect(list.map((p) => p.name)).toEqual(["Mine"])
    expect(polar.id).toBe("custom:Mine")
  })

  it("doesn't duplicate the same polar", () => {
    const first = addCustomPolar([], polarOf("Mine", 5))
    const again = addCustomPolar(first.list, polarOf("Mine", 5))
    expect(again.list).toBe(first.list)
    expect(again.polar).toBe(first.polar)
  })

  it("numbers a different polar with a taken name", () => {
    let r = addCustomPolar([], polarOf("Pasted polar", 5))
    r = addCustomPolar(r.list, polarOf("Pasted polar", 6))
    r = addCustomPolar(r.list, polarOf("Pasted polar", 7))
    expect(r.list.map((p) => p.name)).toEqual(["Pasted polar", "Pasted polar (2)", "Pasted polar (3)"])
    expect(r.polar.id).toBe("custom:Pasted polar (3)")
  })

  it("reads a saved list, skipping broken and duplicate entries", () => {
    const good = polarOf("A", 5)
    expect(parseCustomPolars([good, { name: "broken" }, good, 7])).toEqual([good])
    expect(parseCustomPolars("nope")).toEqual([])
  })
})

describe("parseSettings", () => {
  it("keeps valid values", () => {
    const s = { windFrom: 220, tws: 12.5, destination: 0, marginPct: 1.5, view: "wind" }
    expect(parseSettings(s)).toEqual(s)
  })

  it("drops invalid values and keeps the rest", () => {
    expect(parseSettings({ windFrom: 400, tws: "12", destination: Number.NaN, marginPct: 2, view: "east" })).toEqual({
      marginPct: 2,
    })
  })

  it("ignores garbage", () => {
    expect(parseSettings(null)).toEqual({})
    expect(parseSettings("x")).toEqual({})
  })
})

describe("parsePolarSetting", () => {
  it("reads a library boat id", () => {
    expect(parsePolarSetting({ boatId: "j-109" })).toEqual({ boatId: "j-109" })
  })

  it("reads and normalizes a custom polar", () => {
    const saved = parsePolarSetting({
      custom: { id: "custom:x", name: "X", curves: [{ tws: 10, twa: [90, 45], bsp: [7, 5] }] },
    })
    expect(saved).toEqual({ custom: { id: "custom:x", name: "X", curves: [{ tws: 10, twa: [45, 90], bsp: [5, 7] }] } })
  })

  it("rejects a custom polar with no usable curves", () => {
    expect(parsePolarSetting({ custom: { name: "X", curves: [{ tws: 10, twa: [45], bsp: [5] }] } })).toBeNull()
    expect(parsePolarSetting({ custom: { name: "X" } })).toBeNull()
    expect(parsePolarSetting(42)).toBeNull()
  })
})

describe("resolveTheme", () => {
  it("uses the shared choice, or the OS when there is none", () => {
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
    expect(resolveTheme(null, true)).toBe("dark")
    expect(resolveTheme(null, false)).toBe("light")
    expect(resolveTheme("sepia", true)).toBe("dark")
  })
})
