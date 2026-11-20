import { parsePolar } from "../lib/parse.ts"
import type { Polar } from "../lib/polar.ts"
import { catalog } from "./catalog.ts"

const files = import.meta.glob<string>("./polars/*.pol", { query: "?raw", import: "default", eager: true })

export interface LibraryBoat {
  id: string
  name: string
  group: string
  polar: Polar
}

export const library: LibraryBoat[] = catalog.map((entry) => {
  const text = files[`./polars/${entry.id}.pol`]
  if (text === undefined) throw new Error(`Missing polar file src/data/polars/${entry.id}.pol`)
  const result = parsePolar(text, entry.name)
  if (!result.ok) throw new Error(`src/data/polars/${entry.id}.pol: ${result.error}`)
  return { ...entry, polar: { ...result.polar, id: entry.id, name: entry.name } }
})
