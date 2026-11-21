import { For, Show, type Element as JSXElement } from "solid-js"
import { tackOf, type CourseSample, type Solution } from "../lib/solve.ts"

const heading = (h: number) => `${String(Math.round(h) % 360).padStart(3, "0")}°`
const knots = (v: number) => `${v.toFixed(2)} kn`
const pct = (x: number) => `${Math.round(x * 100)}%`

function twa(s: CourseSample) {
  const tack = tackOf(s.twa)
  const side = tack === "starboard" ? "stbd" : tack === "port" ? "port" : ""
  return `${Math.round(Math.abs(s.twa))}°${side ? ` ${side}` : ""}`
}

function Stat(props: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div class="min-w-0">
      <div class="text-xs text-muted-foreground">{props.label}</div>
      <div class="text-2xl font-semibold tabular-nums tracking-tight" style={{ color: props.color }}>
        {props.value}
      </div>
      <Show when={props.sub}>
        <div class="text-xs text-muted-foreground tabular-nums">{props.sub}</div>
      </Show>
    </div>
  )
}

function Row(props: { label: string; children: JSXElement }) {
  return (
    <div class="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-border py-2 text-sm first:border-t-0 sm:grid-cols-[9rem_1fr]">
      <div class="text-muted-foreground">{props.label}</div>
      <div class="tabular-nums">{props.children}</div>
    </div>
  )
}

export function Readout(props: { solution: Solution | null; margin: number }) {
  const marginLabel = () => `${+(props.margin * 100).toFixed(2)}%`
  return (
    <Show
      when={props.solution}
      fallback={
        <p class="text-sm text-muted-foreground">
          No heading in this polar makes progress toward the destination. Try a different wind speed or polar.
        </p>
      }
    >
      {(s) => (
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Best heading" value={`${heading(s().best.heading)} T`} color="var(--course)" />
            <Stat label="True wind angle" value={twa(s().best)} />
            <Stat label="Boat speed" value={knots(s().best.bsp)} />
            <Stat
              label="Speed toward destination"
              value={knots(s().best.vmc)}
              sub={`${pct(s().best.vmc / s().best.bsp)} of boat speed`}
              color="var(--destination)"
            />
          </div>
          <div>
            <Row label={`Within ${marginLabel()}`}>
              <For each={s().bands} keyed={false}>
                {(b) => (
                  <div>
                    <span class="font-medium text-course">
                      {heading(b().from.heading)} – {heading(b().to.heading)} T
                    </span>
                    <span class="text-muted-foreground">
                      {" "}
                      · TWA {twa(b().from)} – {twa(b().to)}
                    </span>
                  </div>
                )}
              </For>
              <div class="text-xs text-muted-foreground">
                Any of these keeps the speed toward the destination at or above {knots(s().threshold)}.
              </div>
            </Row>
            <Row label="Other tack">
              <Show when={s().otherTack} fallback={<span class="text-muted-foreground">Makes no progress toward the destination</span>}>
                {(o) => (
                  <>
                    <div>
                      {heading(o().heading)} T · TWA {twa(o())} · {knots(o().bsp)} ·{" "}
                      <span class="text-muted-foreground">
                        {knots(o().vmc)} toward destination ({pct(o().vmc / s().best.vmc)} of best)
                      </span>
                    </div>
                    <Show
                      when={s().otherBands.length}
                      fallback={
                        <div class="text-xs text-muted-foreground">
                          Within {marginLabel()} of the best heading, so it's in the range above.
                        </div>
                      }
                    >
                      <For each={s().otherBands} keyed={false}>
                        {(b) => (
                          <div>
                            <span class="font-medium text-course">
                              {heading(b().from.heading)} – {heading(b().to.heading)} T
                            </span>
                            <span class="text-muted-foreground">
                              {" "}
                              · TWA {twa(b().from)} – {twa(b().to)}
                            </span>
                          </div>
                        )}
                      </For>
                      <div class="text-xs text-muted-foreground">
                        Within {marginLabel()} of this tack's best: at or above {knots(s().otherThreshold ?? 0)} toward the
                        destination.
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </Row>
            <Row label="Straight there">
              <Show
                when={s().direct}
                fallback={<span class="text-muted-foreground">Not sailable: the polar has no speed at that wind angle</span>}
              >
                {(d) => (
                  <span>
                    TWA {twa(d())} · {knots(d().bsp)} ·{" "}
                    <span class={d().vmc >= s().threshold ? "text-muted-foreground" : "text-danger"}>
                      {pct(d().vmc / s().best.vmc)} of best
                    </span>
                  </span>
                )}
              </Show>
            </Row>
          </div>
        </div>
      )}
    </Show>
  )
}
