// Writes src/data/polars/<id>.pol for the classes in scripts/boats.ts from ORC's public
// certificate feed (data.orc.org). Run by hand (`pnpm fetch-polars`) to refresh them.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { curvesFromOrcAllowances, type OrcAllowances } from "../src/lib/orc.ts"
import { normalizePolar, type PolarCurve } from "../src/lib/polar.ts"
import { orcBoats } from "./boats.ts"

const OUT_DIR = new URL("../src/data/polars/", import.meta.url)
const CACHE = new URL("../.orc-cache/", import.meta.url)
const FEED = "https://data.orc.org/public/WPub.dll?action=DownRMS&ext=json&Family=1"
const CACHE_MS = 24 * 60 * 60 * 1000

interface Certificate {
  Class?: string
  GPH?: number
  Allowances?: OrcAllowances
}

const normalizeClass = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9.]+/g, " ")
    .trim()

async function download(year: number, country: string): Promise<{ rms: Certificate[]; Countries?: { CountryId: string }[] }> {
  const file = join(CACHE.pathname, `${country}${year}.json`)
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < CACHE_MS) {
    return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))
  }
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${FEED}&VPPYear=${year}&CountryId=${country}`, {
        headers: { "User-Agent": "boatpolarsolver-build", Referer: "https://data.orc.org/public/WPub.dll" },
        signal: AbortSignal.timeout(180_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = (await res.text()).replace(/^﻿/, "")
      const data = JSON.parse(text)
      mkdirSync(CACHE, { recursive: true })
      writeFileSync(file, text)
      return data
    } catch (e) {
      lastError = e
      await new Promise((r) => setTimeout(r, 2000 * attempt))
    }
  }
  throw new Error(`${country} ${year}: ${(lastError as Error).message}`)
}

async function certificatesFor(year: number): Promise<Certificate[]> {
  const index = await download(year, "ORC")
  const countries = (index.Countries ?? []).map((c) => c.CountryId)
  const all: Certificate[] = [...index.rms]
  const queue = countries.filter((c) => c !== "ORC")
  const failures: string[] = []
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        try {
          all.push(...(await download(year, c)).rms)
        } catch (e) {
          failures.push((e as Error).message)
        }
      }
    }),
  )
  if (failures.length) console.warn(`Skipped ${failures.length} feeds: ${failures.join("; ")}`)
  console.log(`ORC ${year}: ${all.length} certificates from ${countries.length} feeds`)
  return all
}

function pick(certs: Certificate[]): Certificate {
  const sorted = [...certs].sort((a, b) => (a.GPH ?? 0) - (b.GPH ?? 0))
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

const num = (x: number) => String(Math.round(x * 100) / 100)

function toPol(name: string, curves: PolarCurve[]): string {
  const angles = [...new Set(curves.flatMap((c) => c.twa))].sort((a, b) => a - b)
  const lines = [name, `TWA\\TWS\t${curves.map((c) => num(c.tws)).join("\t")}`]
  for (const a of angles) {
    const cells = curves.map((c) => {
      const i = c.twa.indexOf(a)
      return i === -1 ? "" : num(c.bsp[i])
    })
    lines.push(`${num(a)}\t${cells.join("\t")}`)
  }
  return lines.join("\n") + "\n"
}

async function main() {
  const year = Number(process.env.ORC_YEAR) || new Date().getUTCFullYear()
  const byYear: [number, Certificate[]][] = []
  const current = await certificatesFor(year)
  byYear.push([year, current])
  if (current.length < 2000) byYear.push([year - 1, await certificatesFor(year - 1)])

  let written = 0
  for (const spec of orcBoats) {
    let done = false
    for (const [, certs] of byYear) {
      const matches = certs.filter((c) => c.Allowances?.WindSpeeds && spec.match.test(normalizeClass(c.Class ?? "")))
      if (!matches.length) continue
      const polar = normalizePolar({ id: spec.id, name: spec.name, curves: curvesFromOrcAllowances(pick(matches).Allowances!) })
      if (!polar.curves.length) continue
      writeFileSync(new URL(`${spec.id}.pol`, OUT_DIR), toPol(spec.name, polar.curves))
      written++
      done = true
      break
    }
    if (!done) console.warn(`No certificate found for ${spec.name}; kept the existing file, if any.`)
  }
  console.log(`Wrote ${written} of ${orcBoats.length} ORC polars to src/data/polars`)
}

await main()
