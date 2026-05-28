# Changelog

All notable changes to this project will be documented in this file. The format
is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — internal cleanup pass

### Changed

- `lib/maxScore.ts` removed; `computeMaxScore` and `tierFor` now imported
  from `console-adventure@0.4.0` (which exposes them as public helpers).
  Single source of truth for the DFS — same algorithm, one implementation.
- `lib/theme.ts` no longer hardcodes the brand palette. Sources `PHOSPHOR /
  AMBER / MAGENTA / CYAN / TEXT / DIM / VOID` from `console-shell`'s
  `DEFAULT_THEME` so any palette shift upstream flows through automatically.
- `lib/edit.ts` uses a small `omit` / `omitFromRecord` helper instead of
  the `const { [key]: _drop, ...rest } = obj; void _drop;` idiom.
- `components/AdventureEditor.tsx` no longer recomputes max score on every
  render (was running the full DFS in a footnote string). Uses the prop.
- `components/AdventureEditor.tsx` derives the tier-colour dropdown from
  `THEME_COLOR_SLOTS` (sourced from `console-shell`'s `ThemeColor`) rather
  than hardcoding the six slot names. Adding a new colour slot upstream
  lights it up here automatically.
- `lib/graph.ts` lifts edge-styling constants (`EDGE_LABEL_STYLE`,
  `EDGE_STROKE_STYLE`, `ARROW_MARKER`) to module scope rather than
  rebuilding them per edge per graph build.

### Fixed

- `Inputs.tsx` `Button` was using a literal `'#FF388F'` for danger colour
  instead of the imported `MAGENTA` constant.
- `Inputs.tsx` `InputProps` had a dead `monospace?: boolean` prop never
  read by any consumer.
- `Terminal.tsx` used the global `JSX.Element` type which isn't reliably
  present under `jsx: react-jsx`; switched to `React.ReactNode`.
- `Toolbar.tsx` contained a noise comment placating an unused-import warning
  that wasn't actually relevant.

### Added

- vitest + jsdom — first test suite in this package. 33 tests covering
  every `lib/edit.ts` helper (including the "refuses to delete last
  remaining choice" and "rewires next references on scene delete" cases),
  `lib/storage.ts` round-trips, and the `omit` helpers.
- CI now runs `npm test` before `npm run build`.

## [0.2.0] — Unreleased

Live editing.

### Added

- **`new` toolbar action** loads a blank single-scene starter so an author
  can build from scratch without first finding an example JSON.
- **Editable inspector panel.** Every field in the right-panel inspector
  is now a styled input. Scene heading, narration (line-per-array-entry
  textarea), choices (label / points / flavour / next-as-dropdown), tier
  table (min-score / label / colour slot), share config (text + url
  templates, intent preset). Add / delete scenes from the adventure-level
  view, add / delete choices on each scene.
- **Live graph updates.** React Flow now runs in controlled mode
  (`useNodesState` / `useEdgesState`) so edits propagate to the canvas
  without a remount — pan, zoom, and selection are preserved across
  every edit. Structural events (load, new, start-scene change) still
  bump the JSON version key to force a remount and re-run fitView.
- **Export actions.** Download the current adventure as a `.json` file
  (with the canonical `$schema` URL injected) or copy to clipboard.
- **Brand-styled form inputs** (`Input` / `NumberInput` / `Textarea` /
  `Select` / `Button`) shared across the editor panels.
- Immutable edit helpers (`lib/edit.ts`) so every mutation is a pure
  `(json, delta) => json` function and the editor never mutates props
  in place. Includes orphan-reference sweep on scene deletion so the
  script stays valid.

### Changed

- Inspector panel widened from 380px to 400px to give the editor inputs
  enough room without crowding.
- Hint text in the canvas's bottom-left reads "click a scene to **edit**"
  instead of "to inspect" to reflect the new behaviour.

## [0.1.0] — Unreleased

Initial release. Phase 2A: read-only visualisation.

### Added

- React + React Flow scaffold with TypeScript and Vite.
- Custom `SceneNode` renderer: heading, one-line narration preview, choice
  list with point values, start-scene magenta highlight.
- Custom `FinishNode`: synthetic terminus shown only when at least one
  choice has `next: null`. Renders the tier table.
- BFS-layered auto-layout — scenes group by depth from `start`, sorted
  within each layer by predecessor x-position to minimise edge crossings.
- Right-hand inspector panel: full scene details on selection, adventure
  stats summary when nothing's selected.
- Toolbar with four load actions: built-in foundry example, paste JSON
  from clipboard, upload a file, fetch from URL.
- Live max-score computation (same DFS as the engine's runtime).
- Brand styling that matches `console-shell`'s `DEFAULT_THEME` palette.
- GitHub Pages deploy workflow.

### Notes

Read-only by design — Phase 2B (drag arrows, edit fields, export JSON,
validate, preview) ships as v0.2.
