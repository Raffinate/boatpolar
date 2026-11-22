import { Button } from "@ui-sdk/solid/button"
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/solid/field"
import { FileInput, FileInputDropzone, FileInputTrigger } from "@ui-sdk/solid/file-input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
  type ListData,
} from "@ui-sdk/solid/select"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/solid/tabs"
import { Textarea } from "@ui-sdk/solid/textarea"
import { createMemo, createSignal, For, Show } from "solid-js"
import { library } from "../data/library.ts"
import { parsePolar, type ParseResult } from "../lib/parse.ts"
import type { Polar } from "../lib/polar.ts"

interface PolarSourceProps {
  current: Polar
  custom: Polar[]
  onLoad: (polar: Polar) => void
  onImport: (polar: Polar) => void
  onRemove: (id: string) => void
}

interface Group {
  label: string
  boats: { id: string; name: string; polar: Polar }[]
}

const libraryGroups: Group[] = [...new Set(library.map((b) => b.group))].map((label) => ({
  label,
  boats: library.filter((b) => b.group === label),
}))

const tabClass =
  "relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-selected:bg-card data-selected:text-foreground data-selected:shadow-sm"

const exampleTable = `TWA\\TWS  6    10   16
45       4.9  6.1  6.6
90       6.2  7.4  8.1
135      5.1  6.9  8.6
180      3.6  5.5  7.4`

function ParseStatus(props: { result: ParseResult | null }) {
  const message = createMemo(() => {
    const r = props.result
    if (!r) return null
    if (!r.ok) return { error: true, text: r.error }
    const c = r.polar.curves
    return {
      error: false,
      text: `Read as ${r.format}: ${c.length} wind speeds (${c[0].tws}–${c[c.length - 1].tws} kn).`,
    }
  })
  return (
    <Show when={message()}>
      {(m) => <p class={["text-sm", m().error ? "text-danger" : "text-muted-foreground"]}>{m().text}</p>}
    </Show>
  )
}

export function PolarSource(props: PolarSourceProps) {
  const [text, setText] = createSignal("")
  const pasted = createMemo<ParseResult | null>(() => (text().trim() ? parsePolar(text(), "Pasted polar") : null))
  const [fileResult, setFileResult] = createSignal<ParseResult | null>(null)

  const groups = createMemo<Group[]>(() =>
    props.custom.length
      ? [{ label: "My polars", boats: props.custom.map((p) => ({ id: p.id, name: p.name, polar: p })) }, ...libraryGroups]
      : libraryGroups,
  )
  const items = createMemo<ListData>(() =>
    groups().map((g) => ({
      type: "group" as const,
      label: g.label,
      items: g.boats.map((b) => ({ value: b.id, label: b.name })),
    })),
  )
  const findBoat = (id: string | null) => groups().flatMap((g) => g.boats).find((b) => b.id === id)
  const selected = createMemo(() => findBoat(props.current.id)?.id ?? null)
  const currentIsCustom = createMemo(() => props.custom.some((p) => p.id === props.current.id))

  const loadFile = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const result = parsePolar(await file.text(), file.name.replace(/\.[^.]+$/, ""))
    setFileResult(result)
    if (result.ok) props.onImport(result.polar)
  }

  return (
    <Tabs defaultValue="library" class="space-y-3">
      <TabsList aria-label="Polar source" class="flex gap-1 rounded-lg bg-muted p-1">
        <TabsTab value="library" class={tabClass} data-ph-capture-attribute-polar-source="library">
          Library
        </TabsTab>
        <TabsTab value="paste" class={tabClass} data-ph-capture-attribute-polar-source="paste">
          Paste
        </TabsTab>
        <TabsTab value="file" class={tabClass} data-ph-capture-attribute-polar-source="file">
          File
        </TabsTab>
      </TabsList>

      <TabsPanel value="library" class="space-y-2 outline-none">
        <Field>
          <FieldLabel class="text-sm font-medium">Boat</FieldLabel>
          <Select
            items={items()}
            value={selected()}
            placeholder="Choose a boat"
            onValueChange={(id) => {
              const boat = findBoat(id as string | null)
              if (boat) props.onLoad(boat.polar)
            }}
          >
            <SelectTrigger class="mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-placeholder:text-muted-foreground">
              <SelectValue />
              <svg viewBox="0 0 24 24" class="size-4 opacity-60" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </SelectTrigger>
            <SelectContent class="m-0 overflow-y-auto rounded-md border border-border bg-card p-1 text-sm text-foreground shadow-lg outline-none">
              <For each={groups()}>
                {(g) => (
                  <SelectGroup>
                    <SelectGroupLabel class="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">{g.label}</SelectGroupLabel>
                    <For each={g.boats}>
                      {(b) => (
                        <SelectItem
                          value={b.id}
                          data-ph-capture-attribute-boat={b.id.startsWith("custom:") ? "custom" : b.id}
                          class="flex cursor-default items-center justify-between gap-4 rounded-sm px-2 py-1.5 outline-none data-highlighted:bg-accent"
                        >
                          {b.name}
                          <SelectItemIndicator>
                            <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </SelectItemIndicator>
                        </SelectItem>
                      )}
                    </For>
                  </SelectGroup>
                )}
              </For>
            </SelectContent>
          </Select>
          <FieldDescription class="mt-1.5 text-xs text-muted-foreground">
            Polars you paste or upload are kept under My polars in this browser.
          </FieldDescription>
        </Field>
        <Show when={currentIsCustom()}>
          <Button
            onClick={() => props.onRemove(props.current.id)}
            data-ph-capture-attribute-action="remove-custom-polar"
            class="h-8 rounded-md border border-input bg-card px-3 text-xs font-medium text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Remove “{props.current.name}” from My polars
          </Button>
        </Show>
      </TabsPanel>

      <TabsPanel value="paste" class="space-y-2 outline-none">
        <Field>
          <FieldLabel class="text-sm font-medium">Polar text</FieldLabel>
          <Textarea
            value={text()}
            onValueChange={(v) => setText(v)}
            rows={8}
            spellcheck={false}
            placeholder={exampleTable}
            class="mt-1.5 w-full resize-y rounded-md border border-input bg-card px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <FieldDescription class="mt-1.5 text-xs text-muted-foreground">
            TWA × TWS tables (tabs, spaces, commas or semicolons), Expedition pairs, ORC JSON or Sailonline XML. The format is detected.
          </FieldDescription>
        </Field>
        <ParseStatus result={pasted()} />
        <Button
          disabled={!pasted()?.ok}
          data-ph-capture-attribute-action="use-pasted-polar"
          onClick={() => {
            const r = pasted()
            if (r?.ok) props.onImport(r.polar)
          }}
          class="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
        >
          Use this polar
        </Button>
      </TabsPanel>

      <TabsPanel value="file" class="space-y-2 outline-none">
        <FileInput onValueChange={(files) => void loadFile(files)}>
          <FileInputDropzone class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm text-muted-foreground data-dragging:border-ring data-dragging:bg-accent">
            <p>Drop a polar file here (.pol, .txt, .csv, .json, .xml)</p>
            <FileInputTrigger class="h-9 rounded-md border border-input bg-card px-4 text-sm font-medium text-foreground shadow-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40">
              Choose file
            </FileInputTrigger>
          </FileInputDropzone>
        </FileInput>
        <ParseStatus result={fileResult()} />
      </TabsPanel>
    </Tabs>
  )
}
