import { describe, expect, it } from "vitest"
import { parsePolarSetting, parseSettings } from "./storage.ts"

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
