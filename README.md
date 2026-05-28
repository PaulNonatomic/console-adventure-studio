<div align="center">

### A visual editor for [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) narratives.

Branching choice-based scripts, rendered as an interactive node graph. Author and edit a text adventure visually, playtest it inside the studio with the real `console-adventure` engine, then export the result as JSON your site can feed straight into `createAdventureFromJson`.

**Live: <https://paulnonatomic.github.io/console-adventure-studio/>**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PullRequests](https://img.shields.io/badge/PRs-welcome-blueviolet)](http://makeapullrequest.com)
[![Releases](https://img.shields.io/github/v/release/PaulNonatomic/console-adventure-studio)](https://github.com/PaulNonatomic/console-adventure-studio/releases)
[![CI](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/ci.yml)
[![Deploy](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/deploy.yml/badge.svg)](https://paulnonatomic.github.io/console-adventure-studio/)

</div>

## Support
If you like my work then please consider showing your support for console-adventure-studio by giving the repo a star or buying me a brew
<br><br>
<a href="https://www.buymeacoffee.com/nonatomic" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-green.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## What this is

`console-adventure-studio` is a tool for working with the JSON-shaped narrative configs that [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) consumes.

**v0.2** adds live editing on top of the v0.1 visualiser: start a new adventure from scratch, edit scene headings / narration / choices / tiers / share config in the inspector panel, watch the graph and the in-studio playtest terminal update in real time, then export the result as a JSON file your site can feed straight into `createAdventureFromJson`.

What's still on the roadmap: drag-arrow rewiring directly on the graph, scene-id renaming with auto-fixup, validation highlights for orphan / unreachable scenes.

The Foundry — the dev-console game on [nonatomic.co.uk](https://nonatomic.co.uk) — ships built-in as the example. Open the studio, the graph is already there.

---

## What you can do today

**View**

- **See the whole adventure at a glance.** Scenes lay out top-down in BFS layers from the start node, edges are labelled with the choice text and points, the start scene is highlighted, and reconverging branches (two scenes both pointing to a third) show up correctly without double-counting.
- **Live stats.** Scene count, choice count, terminal choices, max score (computed with the same DFS the engine uses), tier table, share text/url templates.

**Load**

- **Built-in foundry example**, paste from clipboard, upload a file, or fetch from a URL. Any config that conforms to the [`adventure.schema.json`](https://github.com/PaulNonatomic/console-adventure/blob/main/adventure.schema.json) shape works.
- **New from scratch** — click `new` in the toolbar to start with a blank single-scene template.

**Edit live**

- Click any scene to edit its heading, narration, and every choice (label / points / flavour / next-target) in the right panel. Every change updates the graph and the playtest terminal in real time.
- Add and delete scenes from the adventure overview. New scenes get auto-incremented ids; deleting a scene rewires any choices that pointed at it to `null` so the script stays valid.
- Add and delete choices on each scene. The `next` dropdown lists every existing scene plus `(finish — null)` for terminal choices.
- Edit the tier table — add rows, change min-score / label / colour slot, delete rows.
- Enable, edit, or remove the share intent — including the template strings (`${score}` / `${max}` / `${tier}`) and the platform preset (X / Bluesky / Mastodon).
- Change the start scene via dropdown — the graph re-focuses on the new entry point automatically.

**Playtest**

- Click the **Play** tab on the right panel to run the adventure inside the studio, driven by the real `console-adventure` engine via a captured `Logger`. Choice buttons reflect the current scene; play / restart / share controls appear at the right moments. Edits to scenes restart the playtest from scratch (because the underlying script changed).

**Export**

- Download the current state as a JSON file (with the canonical `$schema` URL pre-filled) or copy it to the clipboard. The result drops straight into `createAdventureFromJson(json, { onComplete: ... })` on any site that uses `console-adventure`.

---

## What's coming

- **Edit mode.** Drag the arrow tip of a choice to wire it to a different scene. Type new heading / narration / choice text into the side panel and watch the graph update. Add and remove scenes.
- **Validation.** Highlight orphan scenes (unreachable from start), choices that point to scenes that don't exist, scenes with no terminal path.
- **Export.** Download the current state as a JSON file (matching `adventure.schema.json`), or copy to clipboard, or generate the wrapper code (`createAdventureFromJson(json, { onComplete: ... })`) that wires it onto a site.
- **Preview.** Run the adventure in a sandboxed dev-console view inside the studio without having to wire it onto a site first.

---

## Local dev

```bash
git clone https://github.com/PaulNonatomic/console-adventure-studio
cd console-adventure-studio
npm install
npm run dev
```

Opens on `http://localhost:5173/console-adventure-studio/`. Hot-reload, full TypeScript.

To build a deployable bundle:

```bash
npm run build      # → ./dist (~110 KB gzipped)
npm run preview    # serve the build locally
```

---

## Stack

- React 18 + TypeScript
- [React Flow / xyflow](https://reactflow.dev) for the node graph
- Vite for build / dev server
- [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) for the `AdventureJson` type + `adventure.schema.json`

No CSS framework — the UI styles inline against a small palette (`src/lib/theme.ts`) that mirrors `console-shell`'s `DEFAULT_THEME`, so the editor's chrome visually matches the runtime output.

---

## License

MIT © Paul Stamp / [Nonatomic Digital Foundry](https://nonatomic.co.uk).

---

## See also

- [`console-shell`](https://github.com/PaulNonatomic/console-shell) — the dev-console CLI surface adventures plug into.
- [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) — the branching narrative engine. This studio reads and writes its `adventure.schema.json` wire format.
