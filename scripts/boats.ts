export interface OrcBoat {
  id: string
  name: string
  /** Matched against the certificate's class, uppercased with punctuation turned into spaces. */
  match: RegExp
}

// Classes without a good full-range polar elsewhere; their ORC certificates are written to src/data/polars.
export const orcBoats: OrcBoat[] = [
  { id: "sun-fast-3300", name: "Jeanneau Sun Fast 3300", match: /^SUN FAST 3300$/ },
  { id: "jpk-10-30", name: "JPK 10.30", match: /^JPK ?10\.?30$/ },
  { id: "jpk-10-80", name: "JPK 10.80", match: /^JPK ?10\.?80$/ },
  { id: "jpk-39-fc", name: "JPK 39 FC", match: /^JPK 39 FC$/ },
  { id: "pogo-36", name: "Pogo 36", match: /^POGO 36$/ },
  { id: "pogo-12-50", name: "Pogo 12.50", match: /^POGO 12\.50$/ },
  { id: "grand-soleil-44", name: "Grand Soleil 44", match: /^GRAND SOLEIL 44$/ },
  { id: "dufour-34", name: "Dufour 34", match: /^DUFOUR 34$/ },
  { id: "figaro-3", name: "Beneteau Figaro 3", match: /^FIGARO 3$/ },
  { id: "mini-6-50", name: "Mini 6.50", match: /^(POGO 6\.50|MINI TRANSAT( 6\.5)?)$/ },
  { id: "cape-31", name: "Cape 31", match: /^CAPE 31$/ },
  { id: "tp-52", name: "TP52", match: /^TP ?52$/ },
  { id: "imoca-60-orc", name: "IMOCA 60", match: /^IMOCA 60$/ },
  { id: "maxi-72", name: "Maxi 72", match: /^MAXI 72$/ },
  { id: "super-maxi-100", name: "Super Maxi 100", match: /^SUPER MAXI 100$/ },
]
