# Boat Polar Solver

Finds the heading that gets a sailing boat to its destination fastest: the one with the highest
speed toward the destination (VMC), given the boat's polar, the true wind direction and speed,
and the destination bearing. Headings within an acceptable margin of the best (1% by default) are
shaded on the diagram and listed below it.

## Polars

- **Library**: curated polar files in `src/data/polars/` (one `.pol` per boat, listed in
  `src/data/catalog.ts`). Most are
  full-range polars from the OpenCPN Weather Routing plugin, trimmed to 30 kn. Classes without a
  good one there use their ORC certificate. `pnpm fetch-polars` rewrites those ORC files from
  data.orc.org; it's run by hand, not during the build. `src/data/library.test.ts` checks every
  library polar for coverage and spikes.
- **Paste** or **File**: the format is detected. Supported: TWA × TWS tables (tab, space, comma or
  semicolon separated, decimal commas allowed, either orientation), Expedition-style rows of wind
  speed followed by angle/speed pairs, ORC certificate JSON, orc-data VPP JSON and Sailonline
  `<vpp>` XML.

Speeds between measured angles use monotone cubic interpolation (no invented peaks); between wind
speeds, linear. Angles outside the polar are treated as not sailable.

## Develop

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm test
pnpm typecheck
pnpm fetch-polars   # refresh the ORC-sourced files in src/data/polars
pnpm build
```

Stack: Solid 2, [ui-sdk](https://ui-sdk.dev) components styled with Tailwind 4, Vite.

## Deploy

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on every push to `main`. In the
repository settings, set **Pages → Source** to **GitHub Actions**.
