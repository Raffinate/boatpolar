import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/solid/segmented-control"
import { createEffect, createMemo, createSignal, type Element as JSXElement } from "solid-js"
import { PolarDiagram, type ViewMode } from "./components/PolarDiagram.tsx"
import { PolarSource } from "./components/PolarSource.tsx"
import { RangeField } from "./components/RangeField.tsx"
import { Readout } from "./components/Readout.tsx"
import { ThemeToggle } from "./components/ThemeToggle.tsx"
import { library } from "./data/library.ts"
import { preparePolar, type Polar } from "./lib/polar.ts"
import { solve } from "./lib/solve.ts"
import {
  addCustomPolar,
  loadCustomPolars,
  loadPolarSetting,
  loadSettings,
  saveCustomPolars,
  savePolarSetting,
  saveSettings,
} from "./lib/storage.ts"

const defaultBoat = library.find((b) => b.id === "first-40-7") ?? library[0]

function initialPolar(): Polar {
  const saved = loadPolarSetting()
  if (saved && "custom" in saved) return saved.custom
  return library.find((b) => saved && b.id === saved.boatId)?.polar ?? defaultBoat.polar
}

function Card(props: { title?: string; class?: string; children: JSXElement }) {
  return (
    <section class={["rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5", props.class]}>
      {props.title && <h2 class="mb-4 text-sm font-semibold">{props.title}</h2>}
      {props.children}
    </section>
  )
}

function Legend(props: { color: string; label: string; dashed?: boolean; dim?: boolean }) {
  return (
    <span class="inline-flex items-center gap-1.5">
      <svg width="18" height="8" aria-hidden="true">
        <line
          x1="1"
          y1="4"
          x2="17"
          y2="4"
          stroke={props.color}
          stroke-width={props.dim ? 1 : 2.5}
          stroke-dasharray={props.dashed ? "4 3" : undefined}
          opacity={props.dim ? 0.5 : 1}
        />
      </svg>
      {props.label}
    </span>
  )
}

const segmentClass =
  "relative rounded-md px-3 py-1 text-xs font-medium text-muted-foreground outline-none data-checked:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"

export function App() {
  const saved = loadSettings()
  const [polar, setPolar] = createSignal<Polar>(initialPolar())
  const [customPolars, setCustomPolars] = createSignal<Polar[]>(loadCustomPolars())
  const importPolar = (p: Polar) => {
    const result = addCustomPolar(customPolars(), p)
    setCustomPolars(result.list)
    setPolar(result.polar)
  }
  const removeCustom = (id: string) => {
    setCustomPolars((list) => list.filter((p) => p.id !== id))
    if (polar().id === id) setPolar(defaultBoat.polar)
  }
  const prepared = createMemo(() => preparePolar(polar()))
  const [tws, setTws] = createSignal(saved.tws ?? 12)
  const [windFrom, setWindFrom] = createSignal(saved.windFrom ?? 220)
  const [destination, setDestination] = createSignal(saved.destination ?? 180)
  const [marginPct, setMarginPct] = createSignal(saved.marginPct ?? 1)
  const [view, setView] = createSignal<ViewMode>(saved.view ?? "north")

  createEffect(
    () => ({ windFrom: windFrom(), tws: tws(), destination: destination(), marginPct: marginPct(), view: view() }),
    saveSettings,
  )
  createEffect(
    () => polar(),
    (p) => savePolarSetting(library.some((b) => b.id === p.id) ? { boatId: p.id } : { custom: p }),
  )
  createEffect(() => customPolars(), saveCustomPolars)

  const windSpeed = createMemo(() => Math.min(prepared().maxTws, Math.max(prepared().minTws, tws())))
  const solution = createMemo(() =>
    solve({
      polar: prepared(),
      tws: windSpeed(),
      windFrom: windFrom(),
      destination: destination(),
      margin: marginPct() / 100,
    }),
  )
  const coverage = createMemo(() => {
    const curves = prepared().curves
    const min = Math.min(...curves.map((c) => c.minTwa))
    const max = Math.max(...curves.map((c) => c.maxTwa))
    return `${Math.round(min)}°–${Math.round(max)}°`
  })

  return (
    <div class="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Boat Polar Solver</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            The heading that gets you to your destination fastest, from your boat's polar and the true wind.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="space-y-4">
          <Card>
            <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Legend color="var(--curve)" label={`${windSpeed().toFixed(1)} kn polar`} />
                <Legend color="var(--muted-foreground)" label="Other wind speeds" dim />
                <Legend color="var(--course)" label="Best heading" />
                <Legend color="var(--course)" label="Other tack margin" dashed />
                <Legend color="var(--destination)" label="Destination" dashed />
                <Legend color="var(--destination)" label="Destination range" />
              </div>
              <SegmentedControl
                aria-label="Diagram orientation"
                value={view()}
                onValueChange={(v) => v && setView(v as ViewMode)}
                class="inline-flex rounded-lg bg-muted p-0.5"
              >
                <SegmentedControlIndicator class="rounded-md bg-card shadow-sm" />
                <SegmentedControlItem value="north" class={segmentClass} data-ph-capture-attribute-view="north">
                  North up
                </SegmentedControlItem>
                <SegmentedControlItem value="wind" class={segmentClass} data-ph-capture-attribute-view="wind">
                  Wind up
                </SegmentedControlItem>
              </SegmentedControl>
            </div>
            <div class="mx-auto max-w-[36rem]">
              <PolarDiagram
                polar={prepared()}
                tws={windSpeed()}
                windFrom={windFrom()}
                destination={destination()}
                solution={solution()}
                view={view()}
                onWindFrom={setWindFrom}
                onDestination={setDestination}
              />
            </div>
            <p class="mt-2 text-center text-xs text-muted-foreground">
              Drag the blue wind handle or the green destination handle around the rim.
              {view() === "wind" ? " In wind-up view, drag the rim to turn the compass." : ""}
            </p>
          </Card>
          <Card>
            <Readout solution={solution()} margin={marginPct() / 100} destination={destination()} />
          </Card>
        </div>

        <div class="space-y-4">
          <Card title="Conditions" class="space-y-5">
            <RangeField
              label="Wind from"
              unit="°T"
              value={windFrom()}
              min={0}
              max={359}
              step={1}
              onChange={setWindFrom}
              color="var(--wind)"
            />
            <RangeField
              label="Wind speed"
              unit="kn"
              value={Number(windSpeed().toFixed(1))}
              min={prepared().minTws}
              max={prepared().maxTws}
              step={0.1}
              onChange={setTws}
              color="var(--curve)"
            />
            <RangeField
              label="Destination bearing"
              unit="°T"
              value={destination()}
              min={0}
              max={359}
              step={1}
              onChange={setDestination}
              color="var(--destination)"
            />
            <RangeField
              label="Acceptable margin"
              unit="%"
              value={marginPct()}
              min={0}
              max={10}
              step={0.1}
              onChange={setMarginPct}
              color="var(--course)"
              hint={
                <p class="mt-1 text-xs text-muted-foreground">
                  Headings that lose less than this much speed toward the destination are shaded.
                </p>
              }
            />
          </Card>

          <Card title="Polar">
            <div class="mb-4 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <div class="font-medium">{polar().name}</div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                {polar().source ? `${polar().source} · ` : ""}
                {prepared().minTws}–{prepared().maxTws} kn wind · TWA {coverage()}
              </div>
            </div>
            <PolarSource
              current={polar()}
              custom={customPolars()}
              onLoad={setPolar}
              onImport={importPolar}
              onRemove={removeCustom}
            />
          </Card>
        </div>
      </div>

      <footer class="mt-8 text-xs text-muted-foreground">
        Wind and polars only: no current, tide or leeway. Library polars: OpenCPN Weather Routing plugin and ORC certificates (data.orc.org).
      </footer>
    </div>
  )
}
