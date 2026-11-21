import { createMemo, createSignal, For, Show } from "solid-js"
import { boatSpeed, type PreparedPolar } from "../lib/polar.ts"
import { angleDiff, norm360, type Band, type Solution } from "../lib/solve.ts"

export type ViewMode = "north" | "wind"

interface PolarDiagramProps {
  polar: PreparedPolar
  tws: number
  windFrom: number
  destination: number
  solution: Solution | null
  view: ViewMode
  onWindFrom: (deg: number) => void
  onDestination: (deg: number) => void
}

const DEG = Math.PI / 180
const R_PLOT = 184
const R_RING = 198
const R_TARGET = 212
const R_HANDLE = 226
const R_OUTER = 244

const ringStep = (max: number) => (max <= 5 ? 1 : max <= 12 ? 2 : max <= 25 ? 5 : 10)
const fmt = (n: number) => n.toFixed(1)

type Kind = "wind" | "destination" | "rotate"

export function PolarDiagram(props: PolarDiagramProps) {
  let svg: SVGSVGElement | undefined
  const [dragging, setDragging] = createSignal<Kind | null>(null)
  let dragStart = { pointer: 0, windFrom: 0 }

  const rot = createMemo(() => (props.view === "wind" ? -props.windFrom : 0))
  const scale = createMemo(() => {
    const step = ringStep(props.polar.maxBsp)
    const max = Math.max(step, Math.ceil(props.polar.maxBsp / step) * step)
    const rings: number[] = []
    for (let s = step; s <= max + 1e-9; s += step) rings.push(s)
    return { k: R_PLOT / max, rings }
  })

  const pt = (angle: number, r: number) => {
    const s = (angle + rot()) * DEG
    return { x: r * Math.sin(s), y: -r * Math.cos(s) }
  }
  const xy = (angle: number, r: number) => {
    const p = pt(angle, r)
    return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }

  const curvePath = (speedAt: (twa: number) => number | null) => {
    let d = ""
    let pen = false
    for (let twa = -180; twa <= 180; twa += 1) {
      const v = speedAt(twa)
      if (v === null) {
        pen = false
        continue
      }
      d += `${pen ? "L" : "M"}${xy(props.windFrom - twa, v * scale().k)}`
      pen = true
    }
    return d
  }

  const baseCurves = createMemo(() =>
    props.polar.curves.map((c) => ({ tws: c.tws, d: curvePath((twa) => c.at(Math.abs(twa))) })),
  )
  const currentCurve = createMemo(() => curvePath((twa) => boatSpeed(props.polar, twa, props.tws)))

  const bandShape = (band: Band) => {
    const span = norm360(band.to.heading - band.from.heading)
    let wedge = "M0 0"
    for (let h = 0; h <= span + 1e-9; h += Math.min(0.5, Math.max(span, 0.1))) {
      const heading = band.from.heading + h
      const v = boatSpeed(props.polar, angleDiff(props.windFrom, heading), props.tws) ?? 0
      wedge += `L${xy(heading, v * scale().k)}`
    }
    const arc = `M${xy(band.from.heading, R_RING)}A${R_RING} ${R_RING} 0 ${span > 180 ? 1 : 0} 1 ${xy(band.to.heading, R_RING)}`
    return { wedge: `${wedge}Z`, arc }
  }
  const bands = createMemo(() => (props.solution?.bands ?? []).map(bandShape))
  const otherBands = createMemo(() => (props.solution?.otherBands ?? []).map(bandShape))

  const destinationRange = createMemo(() => {
    const r = props.solution?.destinationRange
    if (!r) return null
    const span = norm360(r.to - r.from)
    const large = span > 180 ? 1 : 0
    return {
      cone: `M0 0L${xy(r.from, R_RING)}A${R_RING} ${R_RING} 0 ${large} 1 ${xy(r.to, R_RING)}Z`,
      arc: `M${xy(r.from, R_TARGET)}A${R_TARGET} ${R_TARGET} 0 ${large} 1 ${xy(r.to, R_TARGET)}`,
    }
  })

  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  const labels = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  const cardinal: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" }

  const pointerAngle = (e: PointerEvent) => {
    const ctm = svg!.getScreenCTM()
    if (!ctm) return 0
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return norm360(Math.atan2(p.x, -p.y) / DEG)
  }

  const startDrag = (kind: Kind) => (e: PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const resolved = kind === "wind" && props.view === "wind" ? "rotate" : kind
    setDragging(resolved)
    dragStart = { pointer: pointerAngle(e), windFrom: props.windFrom }
  }

  const onMove = (e: PointerEvent) => {
    const kind = dragging()
    if (!kind) return
    const a = pointerAngle(e)
    if (kind === "rotate") {
      props.onWindFrom(Math.round(norm360(dragStart.windFrom - angleDiff(a, dragStart.pointer))) % 360)
    } else {
      const deg = Math.round(norm360(a - rot())) % 360
      if (kind === "wind") props.onWindFrom(deg)
      else props.onDestination(deg)
    }
  }

  const endDrag = () => setDragging(null)

  const handleTransform = (angle: number) => {
    const p = pt(angle, R_HANDLE)
    return `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${norm360(angle + rot()).toFixed(2)})`
  }

  const summary = createMemo(() => {
    const s = props.solution
    if (!s) return "Polar diagram. No heading makes progress toward the destination."
    return `Polar diagram. Best heading ${Math.round(s.best.heading)}° true at ${fmt(s.best.bsp)} knots.`
  })

  return (
    <svg
      ref={(el) => (svg = el)}
      viewBox={`${-R_OUTER - 4} ${-R_OUTER - 4} ${2 * R_OUTER + 8} ${2 * R_OUTER + 8}`}
      class={["block h-auto w-full select-none", { "cursor-grabbing": !!dragging() }]}
      role="img"
      aria-label={summary()}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <circle r={R_OUTER} class="fill-card stroke-border" />
      <path
        d={`M0 ${-R_OUTER}A${R_OUTER} ${R_OUTER} 0 1 1 0 ${R_OUTER}A${R_OUTER} ${R_OUTER} 0 1 1 0 ${-R_OUTER}ZM0 ${-R_RING}A${R_RING} ${R_RING} 0 1 0 0 ${R_RING}A${R_RING} ${R_RING} 0 1 0 0 ${-R_RING}Z`}
        fill-rule="evenodd"
        class={["fill-transparent", props.view === "wind" ? "cursor-grab touch-none" : "pointer-events-none"]}
        onPointerDown={(e) => {
          if (props.view === "wind") startDrag("rotate")(e)
        }}
      />

      <For each={scale().rings}>
        {(s) => (
          <g class="pointer-events-none">
            <circle r={s * scale().k} class="fill-none stroke-border" stroke-width="1" />
            <text
              x={pt(props.windFrom, s * scale().k).x + 4}
              y={pt(props.windFrom, s * scale().k).y - 3}
              class="fill-muted-foreground text-[9px] tabular-nums"
            >
              {s}
            </text>
          </g>
        )}
      </For>

      <g class="pointer-events-none">
        <For each={labels}>
          {(a) => (
            <line
              x1={pt(a, 0).x}
              y1={pt(a, 0).y}
              x2={pt(a, R_RING).x}
              y2={pt(a, R_RING).y}
              class="stroke-border"
              stroke-dasharray="2 4"
            />
          )}
        </For>
        <circle r={R_RING} class="fill-none stroke-foreground/30" />
        <For each={ticks}>
          {(a) => (
            <line
              x1={pt(a, R_RING).x}
              y1={pt(a, R_RING).y}
              x2={pt(a, R_RING + (a % 30 === 0 ? 9 : a % 10 === 0 ? 6 : 3)).x}
              y2={pt(a, R_RING + (a % 30 === 0 ? 9 : a % 10 === 0 ? 6 : 3)).y}
              class="stroke-foreground/40"
            />
          )}
        </For>
        <For each={labels}>
          {(a) => (
            <text
              x={pt(a, R_HANDLE).x}
              y={pt(a, R_HANDLE).y}
              text-anchor="middle"
              dominant-baseline="central"
              class={["text-[11px] tabular-nums", cardinal[a] ? "fill-foreground font-semibold" : "fill-muted-foreground"]}
            >
              {cardinal[a] ?? a}
            </text>
          )}
        </For>
      </g>

      <g class="pointer-events-none">
        <Show when={destinationRange()}>
          {(r) => (
            <>
              <path d={r().cone} class="fill-destination/8 stroke-none" />
              <path d={r().arc} class="fill-none stroke-destination/80" stroke-width="4" stroke-linecap="round" />
            </>
          )}
        </Show>
        <For each={otherBands()} keyed={false}>
          {(band) => (
            <>
              <path d={band().wedge} class="fill-course/10 stroke-none" />
              <path d={band().arc} class="fill-none stroke-course/70" stroke-width="3" stroke-dasharray="5 4" />
            </>
          )}
        </For>
        <For each={bands()} keyed={false}>
          {(band) => (
            <>
              <path d={band().wedge} class="fill-course/20 stroke-none" />
              <path d={band().arc} class="fill-none stroke-course" stroke-width="5" stroke-linecap="round" />
            </>
          )}
        </For>

        <For each={baseCurves()} keyed={false}>
          {(c) => <path d={c().d} class="fill-none stroke-muted-foreground/35" stroke-width="1" />}
        </For>
        <path d={currentCurve()} class="fill-none stroke-curve" stroke-width="2.25" stroke-linejoin="round" />

        <line
          x1="0"
          y1="0"
          x2={pt(props.destination, R_RING).x}
          y2={pt(props.destination, R_RING).y}
          class="stroke-destination"
          stroke-width="1.5"
          stroke-dasharray="6 4"
        />

        <Show when={props.solution}>
          {(s) => (
            <>
              <line
                x1="0"
                y1="0"
                x2={pt(s().best.heading, R_RING).x}
                y2={pt(s().best.heading, R_RING).y}
                class="stroke-course"
                stroke-width="1.5"
              />
              <line
                x1={pt(s().best.heading, s().best.bsp * scale().k).x}
                y1={pt(s().best.heading, s().best.bsp * scale().k).y}
                x2={pt(props.destination, s().best.vmc * scale().k).x}
                y2={pt(props.destination, s().best.vmc * scale().k).y}
                class="stroke-foreground/50"
                stroke-dasharray="3 3"
              />
              <line
                x1="0"
                y1="0"
                x2={pt(props.destination, s().best.vmc * scale().k).x}
                y2={pt(props.destination, s().best.vmc * scale().k).y}
                class="stroke-destination"
                stroke-width="4"
                stroke-linecap="round"
              />
              <Show when={s().otherTack}>
                {(o) => (
                  <>
                    <line
                      x1={pt(o().heading, o().bsp * scale().k).x}
                      y1={pt(o().heading, o().bsp * scale().k).y}
                      x2={pt(props.destination, o().vmc * scale().k).x}
                      y2={pt(props.destination, o().vmc * scale().k).y}
                      class="stroke-foreground/35"
                      stroke-dasharray="3 3"
                    />
                    <circle
                      cx={pt(props.destination, o().vmc * scale().k).x}
                      cy={pt(props.destination, o().vmc * scale().k).y}
                      r="3.5"
                      class="fill-card stroke-destination"
                      stroke-width="2"
                    />
                    <circle
                      cx={pt(o().heading, o().bsp * scale().k).x}
                      cy={pt(o().heading, o().bsp * scale().k).y}
                      r="5"
                      class="fill-card stroke-course"
                      stroke-width="2"
                    />
                  </>
                )}
              </Show>
              <circle
                cx={pt(props.destination, s().best.vmc * scale().k).x}
                cy={pt(props.destination, s().best.vmc * scale().k).y}
                r="4.5"
                class="fill-destination stroke-card"
                stroke-width="1.5"
              />
              <circle
                cx={pt(s().best.heading, s().best.bsp * scale().k).x}
                cy={pt(s().best.heading, s().best.bsp * scale().k).y}
                r="6.5"
                class="fill-course stroke-card"
                stroke-width="2"
              />
            </>
          )}
        </Show>
        <circle r="3" class="fill-foreground" />
      </g>

      <g
        transform={handleTransform(props.destination)}
        class="cursor-grab touch-none"
        aria-hidden="true"
        onPointerDown={startDrag("destination")}
      >
        <circle r="16" class="fill-transparent" />
        <circle r="11" class="fill-destination stroke-card" stroke-width="2" />
        <circle r="4" class="fill-none stroke-card" stroke-width="2" />
      </g>

      <g
        transform={handleTransform(props.windFrom)}
        class="cursor-grab touch-none"
        aria-hidden="true"
        onPointerDown={startDrag("wind")}
      >
        <circle r="16" class="fill-transparent" />
        <line x1="0" y1="11" x2="0" y2="26" class="stroke-wind" stroke-width="3" />
        <circle r="11" class="fill-wind stroke-card" stroke-width="2" />
        <path d="M-5 -3L0 4L5 -3" class="fill-none stroke-card" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </svg>
  )
}
