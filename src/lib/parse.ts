import { curvesFromOrcAllowances, curvesFromOrcDataVpp } from "./orc.ts"
import { normalizePolar, type Polar, type PolarCurve } from "./polar.ts"

export type ParseResult =
  | { ok: true; polar: Polar; format: string }
  | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error })

function finish(curves: PolarCurve[], name: string, format: string, source?: string): ParseResult {
  const polar = normalizePolar({ id: `custom:${name}`, name, source, curves })
  if (!polar.curves.length) {
    return fail(`Read it as ${format}, but found no wind speed with at least two angles and speeds.`)
  }
  return { ok: true, polar, format }
}

export function parsePolar(text: string, name = "Custom polar"): ParseResult {
  const trimmed = text.replace(/^﻿/, "").trim()
  if (!trimmed) return fail("The polar is empty.")
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJson(trimmed, name)
  if (/<\s*(vpp|bs_splined|tws_splined)/i.test(trimmed)) return parseSolXml(trimmed, name)
  return parseTable(trimmed, name)
}

function parseJson(text: string, name: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return fail(`It looks like JSON but doesn't parse: ${(e as Error).message}`)
  }
  const record: unknown = Array.isArray(data) ? data[0] : data
  if (!isObject(record)) return fail("The JSON has no polar in it.")

  const orc: unknown = Array.isArray(record.rms) ? record.rms[0] : record
  if (isObject(orc) && isObject(orc.Allowances)) {
    const a = numberLists(orc.Allowances)
    const { WindSpeeds, WindAngles } = a
    if (!WindSpeeds || !WindAngles) return fail("The ORC certificate's Allowances need WindSpeeds and WindAngles lists.")
    return finish(
      curvesFromOrcAllowances({ ...a, WindSpeeds, WindAngles }),
      firstText(orc.Class, orc.YachtName) ?? name,
      "ORC certificate (JSON)",
      "ORC certificate",
    )
  }

  if (isObject(record.vpp)) {
    const v = numberLists(record.vpp)
    const { angles, speeds } = v
    if (!angles || !speeds) return fail("The VPP data needs angles and speeds lists.")
    const boatType = isObject(record.boat) ? record.boat.type : undefined
    return finish(
      curvesFromOrcDataVpp({ ...v, angles, speeds }),
      firstText(boatType, record.name) ?? name,
      "ORC VPP data (JSON)",
      "ORC certificate",
    )
  }

  if (Array.isArray(record.curves)) {
    const curves = record.curves.filter(isObject).map((c) => ({
      tws: typeof c.tws === "number" ? c.tws : NaN,
      twa: numbers(c.twa) ?? [],
      bsp: numbers(c.bsp) ?? [],
    }))
    return finish(curves, firstText(record.name) ?? name, "polar JSON", firstText(record.source))
  }

  const tws = numbers(record.tws)
  const twa = numbers(record.twa)
  if (tws && twa && Array.isArray(record.bsp)) {
    const rows = record.bsp.map((row) => numbers(row))
    const curves = tws.map((speed, j) => ({ tws: speed, twa, bsp: twa.map((_, i) => rows[i]?.[j] ?? NaN) }))
    return finish(curves, firstText(record.name) ?? name, "polar JSON (grid)")
  }
  return fail("The JSON isn't a format I know: expected an ORC certificate, ORC VPP data, or { tws, twa, bsp }.")
}

type JsonObject = Record<string, unknown>

const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v)

/** A JSON list as numbers. Anything that isn't a number becomes NaN, which normalizePolar drops. */
const numbers = (v: unknown): number[] | undefined =>
  Array.isArray(v) ? v.map((x: unknown) => (typeof x === "number" ? x : NaN)) : undefined

/** Every list in an object, as numbers; other values are left out. */
function numberLists(o: JsonObject): Record<string, number[] | undefined> {
  const out: Record<string, number[] | undefined> = {}
  for (const [key, value] of Object.entries(o)) {
    const list = numbers(value)
    if (list) out[key] = list
  }
  return out
}

/** The first non-empty string. */
const firstText = (...values: unknown[]) => values.find((v): v is string => typeof v === "string" && v !== "")

const numberList = (s: string) =>
  s
    .trim()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number)

function parseSolXml(text: string, name: string): ParseResult {
  const tag = (t: string) => text.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, "i"))?.[1]
  const twsText = tag("tws_splined") ?? tag("tws")
  const twaText = tag("twa_splined") ?? tag("twa")
  const bsText = tag("bs_splined") ?? tag("bs")
  if (!twsText || !twaText || !bsText) return fail("The XML needs tws, twa and bs (or *_splined) elements.")
  const tws = numberList(twsText)
  const twa = numberList(twaText)
  const rows = bsText
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.split(/[\s,]+/).filter(Boolean).map(Number))
  const byTwa = rows.length === twa.length && rows.every((r) => r.length === tws.length)
  const byTws = rows.length === tws.length && rows.every((r) => r.length === twa.length)
  if (!byTwa && !byTws) {
    return fail(`The XML speeds don't match its ${twa.length} angles and ${tws.length} wind speeds.`)
  }
  const curves = tws.map((w, j) => ({
    tws: w,
    twa,
    bsp: twa.map((_, i) => (byTwa ? rows[i][j] : rows[j][i])),
  }))
  return finish(curves.filter((c) => c.tws > 0), name, "Sailonline XML")
}

type Cell = number | null

function detectDelimiter(lines: string[]): RegExp {
  const sample = lines.slice(0, 10).join("\n")
  if (sample.includes("\t")) return /\t/
  if (sample.includes(";")) return /;/
  const commaRows = lines.slice(0, 10).filter((l) => l.includes(",")).length
  if (commaRows >= Math.min(lines.length, 10) / 2) return /,/
  return /\s+/
}

function toCell(raw: string, decimalComma: boolean): Cell | string {
  const s = raw.trim()
  if (s === "" || s === "-" || /^n\/?a$/i.test(s) || /^nan$/i.test(s)) return null
  const n = Number(decimalComma ? s.replace(",", ".") : s)
  return Number.isFinite(n) ? n : s
}

const increasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1])

function parseTable(text: string, name: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(#|!|\/\/)/.test(l))
  if (lines.length < 2) return fail("Expected a table with a header row and at least one row of speeds.")
  const delimiter = detectDelimiter(lines)
  const decimalComma = delimiter.source !== "," && /\d,\d/.test(text) && !/\d\.\d/.test(text)
  const allRows = lines.map((l) => l.split(delimiter).map((c) => toCell(c, decimalComma)))
  const isHeader = (r: (Cell | string)[], next: (Cell | string)[] | undefined) =>
    r.length >= 3 &&
    r.slice(1).every((c) => typeof c !== "string") &&
    r.slice(1).filter((c) => typeof c === "number").length >= 2 &&
    !!next &&
    next.length >= 2 &&
    typeof next[0] === "number"
  const start = allRows.findIndex((r, i) => isHeader(r, allRows[i + 1]))
  if (start > 0) name = lines[0]
  const rows = start > 0 ? allRows.slice(start) : allRows
  while (rows.every((r) => r.length > 1 && r[r.length - 1] === null)) rows.forEach((r) => r.pop())

  const header = rows[0]
  const corner = header[0]
  const headerNums = header.slice(1)
  const allNumeric = (r: (Cell | string)[]) => r.every((c) => typeof c !== "string")
  const nums = (r: (Cell | string)[]) => r.filter((c): c is number => typeof c === "number")

  if (allNumeric(header) && rows.every(allNumeric)) {
    const sameLength = rows.every((r) => r.length === header.length)
    const firstCol = rows.slice(1).map((r) => r[0] as number)
    if (sameLength && increasing(nums(headerNums)) && increasing(firstCol) && header.length > 2) {
      return parseGrid(rows as Cell[][], name, "TWA \\ TWS table", false)
    }
    return parsePairs(rows as Cell[][], name)
  }

  if (!headerNums.length || !headerNums.every((c) => typeof c === "number")) {
    return fail("Couldn't read the header row: after the first cell it should list wind speeds (or angles).")
  }
  const label = typeof corner === "string" ? corner.toLowerCase() : ""
  let transposed: boolean
  if (/tws\s*[\\/|x]\s*twa/.test(label)) transposed = true
  else if (/twa\s*[\\/|x]\s*tws/.test(label)) transposed = false
  else {
    const headerMax = Math.max(...nums(headerNums))
    const rowMax = Math.max(...rows.slice(1).map((r) => (typeof r[0] === "number" ? r[0] : 0)))
    transposed = headerMax > 60 && rowMax <= 60
  }
  const body = rows.slice(1).filter((r) => typeof r[0] === "number")
  if (!body.length) return fail("The table has a header but no rows that start with a number.")
  const bad = body.find((r) => r.slice(1).some((c) => typeof c === "string"))
  if (bad) return fail(`A row has text where a speed should be: "${bad.join(" ")}".`)
  return parseGrid([[null, ...headerNums] as Cell[], ...(body as Cell[][])], name, transposed ? "TWS \\ TWA table" : "TWA \\ TWS table", transposed)
}

function parseGrid(rows: Cell[][], name: string, format: string, transposed: boolean): ParseResult {
  const colKeys = rows[0].slice(1)
  const rowKeys = rows.slice(1).map((r) => r[0])
  const value = (i: number, j: number) => rows[i + 1][j + 1] ?? null
  const twsKeys = transposed ? rowKeys : colKeys
  const twaKeys = transposed ? colKeys : rowKeys
  const curves: PolarCurve[] = []
  twsKeys.forEach((tws, t) => {
    if (tws === null || tws <= 0) return
    const twa: number[] = []
    const bsp: number[] = []
    twaKeys.forEach((a, k) => {
      const v = transposed ? value(t, k) : value(k, t)
      if (a === null || v === null) return
      twa.push(a)
      bsp.push(v)
    })
    curves.push({ tws, twa, bsp })
  })
  return finish(curves, name, format)
}

function parsePairs(rows: Cell[][], name: string): ParseResult {
  const curves: PolarCurve[] = []
  for (const row of rows) {
    const values = row.filter((c): c is number => c !== null)
    if (values.length < 5 || values.length % 2 === 0) {
      return fail("Each row should be a wind speed followed by angle and speed pairs, or the table needs a header row.")
    }
    const [tws, ...rest] = values
    const twa: number[] = []
    const bsp: number[] = []
    for (let i = 0; i < rest.length; i += 2) {
      twa.push(rest[i])
      bsp.push(rest[i + 1])
    }
    if (!increasing(twa) || twa.some((a) => a < 0 || a > 180)) {
      return fail(`The row for ${tws} kn doesn't have increasing angles between 0 and 180°.`)
    }
    curves.push({ tws, twa, bsp })
  }
  return finish(curves, name, "wind speed + angle/speed pairs (Expedition style)")
}
