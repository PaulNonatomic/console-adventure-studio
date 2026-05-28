# console-adventure-studio

> Visual editor + visualiser for [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) narratives. Branching choice-based scripts, rendered as an interactive node graph.

[![CI](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/ci.yml)
[![Deploy](https://github.com/PaulNonatomic/console-adventure-studio/actions/workflows/deploy.yml/badge.svg)](https://paulnonatomic.github.io/console-adventure-studio/)
[![license: MIT](https://img.shields.io/badge/license-MIT-c7f441.svg)](./LICENSE)

**Live: <https://paulnonatomic.github.io/console-adventure-studio/>**

---

## What this is

`console-adventure-studio` is a tool for working with the JSON-shaped narrative configs that [`console-adventure`](https://github.com/PaulNonatomic/console-adventure) consumes. Today (v0.1) it's a **read-only visualiser**: load an adventure, see its scene graph laid out as a node diagram, inspect any scene's full content in the side panel, watch the max score and tier table resolve live.

Edit mode (drag arrows between scenes to wire choices, edit fields in the side panel, validate, export JSON) is planned for v0.2.

The Foundry — the dev-console game on [nonatomic.co.uk](https://nonatomic.co.uk) — ships built-in as the example. Open the studio, the graph is already there.

---

## What you can do today

- **See the whole adventure at a glance.** Scenes lay out top-down in BFS layers from the start node, edges are labelled with the choice text and points, the start scene is highlighted, and reconverging branches (two scenes both pointing to a third) show up correctly without double-counting.
- **Inspect any scene.** Click a node to drop its full heading, narration, every choice's flavour text, point value, and `next` target into the right-hand panel.
- **See live stats.** Scene count, choice count, terminal choices, max score (computed with the same DFS the engine uses), tier table, share text/url templates.
- **Load your own JSON.** Built-in foundry example, paste from clipboard, upload a file, or fetch from a URL. Any config that conforms to the [`adventure.schema.json`](https://github.com/PaulNonatomic/console-adventure/blob/main/adventure.schema.json) shape works.

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
