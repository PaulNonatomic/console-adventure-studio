# Changelog

All notable changes to this project will be documented in this file. The format
is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
