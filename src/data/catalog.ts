export interface CatalogEntry {
  /** File name in ./polars without the .pol extension. */
  id: string
  name: string
  group: string
}

const OCEAN = "Ocean racing"
const CLUB = "Offshore & club racers"
const CRUISE = "Cruisers"

export const catalog: CatalogEntry[] = [
  { id: "imoca-60-orc", name: "IMOCA 60 (ORC certificate)", group: OCEAN },
  { id: "imoca-60-2007", name: "IMOCA 60 (2007 generation)", group: OCEAN },
  { id: "class-40", name: "Class40", group: OCEAN },
  { id: "vo-65", name: "Volvo Ocean 65", group: OCEAN },
  { id: "vo-70", name: "Volvo Open 70", group: OCEAN },
  { id: "maxi-72", name: "Maxi 72", group: OCEAN },
  { id: "super-maxi-100", name: "Super Maxi 100", group: OCEAN },
  { id: "maxi-trimaran-2013", name: "Maxi trimaran (2013)", group: OCEAN },
  { id: "tp-52", name: "TP52", group: OCEAN },
  { id: "cape-31", name: "Cape 31", group: OCEAN },
  { id: "figaro-3", name: "Beneteau Figaro 3", group: OCEAN },
  { id: "figaro-2", name: "Beneteau Figaro 2", group: OCEAN },
  { id: "mini-6-50", name: "Mini 6.50", group: OCEAN },

  { id: "first-40-7", name: "Beneteau First 40.7", group: CLUB },
  { id: "first-40", name: "Beneteau First 40", group: CLUB },
  { id: "first-45", name: "Beneteau First 45", group: CLUB },
  { id: "first-47-7", name: "Beneteau First 47.7", group: CLUB },
  { id: "j-105", name: "J/105", group: CLUB },
  { id: "j-109", name: "J/109", group: CLUB },
  { id: "j-111", name: "J/111", group: CLUB },
  { id: "j-120", name: "J/120", group: CLUB },
  { id: "j-122", name: "J/122", group: CLUB },
  { id: "j-133", name: "J/133", group: CLUB },
  { id: "sun-fast-3200", name: "Jeanneau Sun Fast 3200", group: CLUB },
  { id: "sun-fast-3300", name: "Jeanneau Sun Fast 3300", group: CLUB },
  { id: "sun-fast-3600", name: "Jeanneau Sun Fast 3600", group: CLUB },
  { id: "jpk-960", name: "JPK 960", group: CLUB },
  { id: "jpk-10-30", name: "JPK 10.30", group: CLUB },
  { id: "jpk-10-80", name: "JPK 10.80", group: CLUB },
  { id: "jpk-39-fc", name: "JPK 39 FC", group: CLUB },
  { id: "pogo-10-50", name: "Pogo 10.50", group: CLUB },
  { id: "pogo-36", name: "Pogo 36", group: CLUB },
  { id: "pogo-12-50", name: "Pogo 12.50", group: CLUB },
  { id: "x-40", name: "X-40", group: CLUB },
  { id: "x-41", name: "X-41", group: CLUB },
  { id: "swan-45", name: "Swan 45", group: CLUB },
  { id: "swan-48", name: "Swan 48", group: CLUB },
  { id: "grand-soleil-44", name: "Grand Soleil 44", group: CLUB },
  { id: "a35", name: "Archambault A35", group: CLUB },
  { id: "imx-40", name: "IMX-40", group: CLUB },
  { id: "dehler-38", name: "Dehler 38", group: CLUB },

  { id: "dufour-34", name: "Dufour 34", group: CRUISE },
  { id: "oceanis-40", name: "Beneteau Oceanis 40", group: CRUISE },
  { id: "oceanis-45", name: "Beneteau Oceanis 45", group: CRUISE },
  { id: "bavaria-38", name: "Bavaria 38 Cruiser", group: CRUISE },
  { id: "hallberg-rassy-40", name: "Hallberg-Rassy 40", group: CRUISE },
  { id: "amel-54", name: "Amel 54", group: CRUISE },
]
