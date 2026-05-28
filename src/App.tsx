/**
 * Top-level layout: toolbar across the top, graph canvas on
 * the left, tabbed RightPanel on the right (Inspect / Play).
 *
 * State held here:
 *   - `json`           — current AdventureJson
 *   - `jsonVersion`    — counter, bumped on structural events
 *                        (load, new, start-scene change). Used
 *                        as the ReactFlow `key` so the canvas
 *                        remounts and fitView re-runs.
 *   - `selectedScene`  — id of the selected scene node, or null
 *   - `error`          — last error message from a load action
 *
 * The graph runs in *controlled* mode (`useNodesState` /
 * `useEdgesState`). Without the change handlers React Flow
 * can't propagate selection state to all nodes — some clicks
 * visibly do nothing. With them, edits to `json` flow into the
 * graph via a useEffect that rebuilds the nodes/edges arrays,
 * and the canvas updates in place without losing the user's
 * pan/zoom or selection.
 *
 * Live editing path:
 *   user edits a field in the panel
 *     → onJsonChange called with updated AdventureJson
 *     → setJson(next)
 *     → useEffect rebuilds graph nodes/edges, setRfNodes runs
 *     → ReactFlow re-renders the canvas in place (no remount)
 *
 * Structural path (load / new / change start scene):
 *   user clicks load/new
 *     → setJson(next) + bumpVersion()
 *     → key={jsonVersion} change forces ReactFlow remount
 *     → fitView re-runs focused on start + successors
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	type Node,
	type Edge,
	type OnSelectionChangeParams,
	type Viewport,
	BackgroundVariant,
	useNodesState,
	useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

/**
 * Zoom config.
 *
 * `DEFAULT_ZOOM` is the exact level fitView lands at on load —
 * both min and max in fitViewOptions are set to this same
 * value so React Flow can't pick anything else when it
 * auto-fits. (Previous incarnation set min=1.056, max=1.6 —
 * fitView's "natural" fit for the start + successors was
 * above 1.6, so it clamped to the max ceiling instead of the
 * tuned floor.)
 *
 * `CANVAS_MIN_ZOOM` / `CANVAS_MAX_ZOOM` are the wider bounds
 * the user can scroll-wheel / button-zoom INSIDE after the
 * initial fit — they don't affect the default view.
 */
const DEFAULT_ZOOM = 1.056;
const CANVAS_MIN_ZOOM = 0.2;
const CANVAS_MAX_ZOOM = 2;

import { Toolbar } from './components/Toolbar';
import { RightPanel } from './components/RightPanel';
import { SceneNode } from './components/SceneNode';
import { FinishNode } from './components/FinishNode';
import { LoadDialog } from './components/LoadDialog';
import { buildGraph, FINISH_NODE_ID, ARROW_MARKER_ID } from './lib/graph';
import { layoutGraph } from './lib/layout';
import { computeMaxScore } from 'console-adventure';
import { FOUNDRY_EXAMPLE } from './lib/examples';
import { BLANK_ADVENTURE } from './lib/blank';
import { createSave, storageAvailable } from './lib/storage';
import { VOID, PHOSPHOR, MAGENTA, AMBER, DIM, PANEL, PANEL_BORDER } from './lib/theme';

/**
 * Custom arrow marker.
 *
 * Geometry:
 *   - Triangle path: M 0 0 L 10 5 L 0 10 z — tip at x=10
 *   - refX="10" — the tip is the anchor point that sits on
 *     the line endpoint. The base (x=0) extends backward
 *     along the line, toward the source node, into the gap
 *     between nodes. So the visible arrow sits in the
 *     inter-node gap, tip kissing the target node's handle.
 *   - markerWidth/Height kept small so the triangle's
 *     interior is barely wider than the edge stroke — the
 *     line and the triangle visually merge along the line's
 *     axis without an obvious "line stabbing the arrow"
 *     artifact.
 *
 * Earlier incarnations:
 *   - React Flow built-in `arrowclosed` was the same geometry
 *     but at default size, which made the interior wide enough
 *     that the line through the centre was very visible.
 *   - Custom with refX=1 had the triangle extending FORWARD
 *     past the line endpoint, which put it inside the target
 *     node's area — node z-order covered the triangle and
 *     made the arrows look like they disappeared.
 */
function MarkerDefs() {
	return (
		<svg
			aria-hidden="true"
			style={{
				position: 'absolute',
				width: 0,
				height: 0,
				overflow: 'hidden',
				pointerEvents: 'none'
			}}
		>
			<defs>
				<marker
					id={ARROW_MARKER_ID}
					viewBox="0 0 10 10"
					refX="10"
					refY="5"
					markerWidth="9"
					markerHeight="9"
					orient="auto"
				>
					<path d="M 0 0 L 10 5 L 0 10 z" fill={AMBER} />
				</marker>
			</defs>
		</svg>
	);
}
import type { AdventureJson } from 'console-adventure';

const nodeTypes = { scene: SceneNode, finish: FinishNode };

export default function App() {
	const [json, setJson] = useState<AdventureJson>(FOUNDRY_EXAMPLE);
	const [jsonVersion, setJsonVersion] = useState(0);
	const [selectedScene, setSelectedScene] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [currentSaveName, setCurrentSaveName] = useState<string | null>(null);

	// Whether localStorage is usable in this browsing context.
	// Resolved once on first render; passed through to the
	// toolbar so save / load fade rather than silently no-op
	// in private browsing / storage-blocked contexts.
	const saveAvailable = useMemo(() => storageAvailable(), []);

	const maxScore = useMemo(() => computeMaxScore(json), [json]);

	// Seed useNodesState / useEdgesState with the computed
	// graph on the FIRST render. Previously they started as
	// empty arrays and got populated by a useEffect — but
	// React Flow's `fitView` prop fires once on mount, and an
	// empty-nodes fit lands on whatever React Flow's fallback
	// viewport happens to be (NOT on fitViewOptions). When the
	// real nodes arrived via setRfNodes a tick later, fitView
	// was already done, so the zoom got stuck at the fallback.
	// `useMemo` with empty deps captures the initial json /
	// maxScore at mount; `key={jsonVersion}` remounts to refresh
	// on structural changes.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const initialGraph = useMemo(() => {
		const built = buildGraph(json, maxScore);
		return {
			nodes: layoutGraph(built.nodes, built.edges, json.start),
			edges: built.edges
		};
	}, []);

	const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>(
		initialGraph.nodes
	);
	const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(
		initialGraph.edges
	);

	// Sync into React Flow's state on subsequent json edits
	// (which don't bump jsonVersion / cause a remount).
	const isFirstRenderRef = useRef(true);
	useEffect(() => {
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			return;
		}
		const built = buildGraph(json, maxScore);
		const positioned = layoutGraph(built.nodes, built.edges, json.start);
		// Carry over React Flow's `selected` flag from the
		// previous nodes by id. Without this, every json edit
		// (every keystroke in the heading / narration / etc.)
		// drops fresh node objects with no selection state in —
		// React Flow then fires `onSelectionChange` with an
		// empty array, which sets selectedScene to null and
		// bounces the user out of the editor view.
		setRfNodes((prev) => {
			const wasSelected = new Map(prev.map((n) => [n.id, !!n.selected]));
			return positioned.map((n) =>
				wasSelected.get(n.id) ? { ...n, selected: true } : n
			);
		});
		setRfEdges(built.edges);
	}, [json, maxScore, setRfNodes, setRfEdges]);

	const focusNodeIds = useMemo(() => {
		const successors =
			json.scenes[json.start]?.choices
				.map((c) => c.next)
				.filter((n): n is string => n !== null) ?? [];
		return Array.from(new Set([json.start, ...successors]));
	}, [json]);

	const handleSelectionChange = useCallback(
		(params: OnSelectionChangeParams) => {
			const node: Node | undefined = params.nodes[0];
			if (!node || node.id === FINISH_NODE_ID) {
				setSelectedScene(null);
			} else {
				setSelectedScene(node.id);
			}
		},
		[]
	);

	// Zoom tuning logger. While iterating, log every meaningful
	// zoom change so a developer can pan/zoom to a value that
	// looks right, then copy it back into `DEFAULT_ZOOM`.
	// Throttled by `> 0.005` delta so a drag doesn't spam the
	// console. Once the default settles, this whole block (the
	// ref, handler, and useEffect) can come out.
	const lastLoggedZoomRef = useRef<number | null>(null);
	const handleMove = useCallback((_: unknown, viewport: Viewport) => {
		const z = viewport.zoom;
		const prev = lastLoggedZoomRef.current;
		if (prev !== null && Math.abs(z - prev) < 0.005) return;
		lastLoggedZoomRef.current = z;
		// eslint-disable-next-line no-console
		console.log(
			`%c[adventure-studio]%c zoom %c${z.toFixed(3)}%c · fitView locked to ${DEFAULT_ZOOM} · canvas range [${CANVAS_MIN_ZOOM}, ${CANVAS_MAX_ZOOM}]`,
			'color: #C7F441; font-weight: bold;',
			'color: #909090;',
			'color: #F5A623; font-weight: bold;',
			'color: #909090;'
		);
	}, []);

	// One-shot startup log so the configured defaults are
	// visible even before the user moves the camera.
	useEffect(() => {
		// eslint-disable-next-line no-console
		console.log(
			`%c[adventure-studio]%c fitView locks to zoom %c${DEFAULT_ZOOM}%c · user-zoom range [%c${CANVAS_MIN_ZOOM}%c, %c${CANVAS_MAX_ZOOM}%c]. Zoom around to find a value, then update DEFAULT_ZOOM in App.tsx.`,
			'color: #C7F441; font-weight: bold;',
			'color: #909090;',
			'color: #F5A623; font-weight: bold;',
			'color: #909090;',
			'color: #F5A623;',
			'color: #909090;',
			'color: #F5A623;',
			'color: #909090;'
		);
	}, []);

	// Edits stream in from the editor panels via this handler.
	// Default behaviour is "update in place" (no remount).
	// Callers pass `{ remount: true }` for structural changes
	// (start-scene swap) where they want fitView to re-run.
	const handleJsonChange = useCallback(
		(next: AdventureJson, opts?: { remount?: boolean }) => {
			setJson(next);
			if (opts?.remount) setJsonVersion((v) => v + 1);
		},
		[]
	);

	function loadJson(parsed: unknown) {
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			!('start' in parsed) ||
			!('scenes' in parsed)
		) {
			setError('JSON is missing required fields (start, scenes).');
			return;
		}
		setJson(parsed as AdventureJson);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
	}

	function loadExample() {
		setJson(FOUNDRY_EXAMPLE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
	}

	function newAdventure() {
		setJson(BLANK_ADVENTURE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
		setCurrentSaveName(null);
	}

	function saveCurrent() {
		// Prefill with the existing save name (if any) or the
		// adventure's start scene id. window.prompt is good
		// enough for a one-field "name this thing" interaction
		// — no need for a dedicated modal.
		const defaultName = currentSaveName ?? `Adventure ${new Date().toLocaleDateString()}`;
		const name = window.prompt('Name this save:', defaultName);
		if (!name) return;
		const id = createSave(name.trim(), json);
		if (id === null) {
			setError("Couldn't save to localStorage (quota or blocked).");
			return;
		}
		setCurrentSaveName(name.trim());
	}

	function loadFromStorage(loadedJson: AdventureJson, name: string) {
		setJson(loadedJson);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
		setCurrentSaveName(name);
	}

	return (
		<div
			style={{
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				background: VOID,
				color: '#eef0f5'
			}}
		>
			<Toolbar
				onLoadExample={loadExample}
				onLoadJson={loadJson}
				onNewAdventure={newAdventure}
				onSave={saveCurrent}
				onOpenLoadDialog={() => setShowLoadDialog(true)}
				saveAvailable={saveAvailable}
				onError={setError}
			/>

			{showLoadDialog && (
				<LoadDialog
					onClose={() => setShowLoadDialog(false)}
					onLoad={loadFromStorage}
				/>
			)}

			{error && (
				<div
					style={{
						background: '#2a1018',
						color: MAGENTA,
						borderBottom: `1px solid ${PANEL_BORDER}`,
						padding: '8px 18px',
						fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
						fontSize: 11,
						display: 'flex',
						justifyContent: 'space-between'
					}}
				>
					<span>⚠ {error}</span>
					<button
						onClick={() => setError(null)}
						style={{
							background: 'transparent',
							border: 'none',
							color: AMBER,
							cursor: 'pointer',
							fontFamily: 'inherit',
							fontSize: 11
						}}
					>
						dismiss
					</button>
				</div>
			)}

			<MarkerDefs />

			<div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
				<div style={{ flex: 1, position: 'relative' }}>
					<ReactFlow
						key={jsonVersion}
						nodes={rfNodes}
						edges={rfEdges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						nodeTypes={nodeTypes}
						onSelectionChange={handleSelectionChange}
						onMove={handleMove}
						fitView
						fitViewOptions={{
							nodes: focusNodeIds.map((id) => ({ id })),
							padding: 0.15,
							// Both min and max set to DEFAULT_ZOOM so
							// fitView can't pick anything else — the
							// "natural" fit for start + successors is
							// usually higher than what reads well, so we
							// clamp from above as well as below. The
							// user-zoom range below stays wide so they can
							// still zoom out/in via the controls.
							minZoom: DEFAULT_ZOOM,
							maxZoom: DEFAULT_ZOOM
						}}
						minZoom={CANVAS_MIN_ZOOM}
						maxZoom={CANVAS_MAX_ZOOM}
						proOptions={{ hideAttribution: true }}
						style={{ background: VOID }}
					>
						<Background
							color={PANEL_BORDER}
							variant={BackgroundVariant.Dots}
							gap={20}
							size={1}
						/>
						<Controls
							position="top-right"
							style={{ background: PANEL, border: `1px solid ${PANEL_BORDER}` }}
						/>
						<MiniMap
							style={{
								background: PANEL,
								border: `1px solid ${PANEL_BORDER}`
							}}
							maskColor="rgba(10, 10, 15, 0.7)"
							nodeColor={(n) =>
								n.id === FINISH_NODE_ID ? MAGENTA : PHOSPHOR
							}
							nodeStrokeColor={PANEL_BORDER}
						/>
					</ReactFlow>

					<div
						style={{
							position: 'absolute',
							bottom: 16,
							left: 16,
							color: DIM,
							fontSize: 10,
							fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
							pointerEvents: 'none'
						}}
					>
						scroll to zoom · drag to pan · click a scene to edit
					</div>
				</div>

				<RightPanel
					json={json}
					maxScore={maxScore}
					selectedSceneId={selectedScene}
					onJsonChange={handleJsonChange}
					onSelectScene={setSelectedScene}
				/>
			</div>
		</div>
	);
}
