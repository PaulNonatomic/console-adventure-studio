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
	ReactFlowProvider,
	Background,
	Controls,
	MiniMap,
	type Node,
	type Edge,
	type Connection,
	type OnSelectionChangeParams,
	type FinalConnectionState,
	BackgroundVariant,
	useNodesState,
	useEdgesState,
	useReactFlow
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
import { RightPanel, type Tab } from './components/RightPanel';
import { SceneNode } from './components/SceneNode';
import { FinishNode } from './components/FinishNode';
import { ChoiceEdge } from './components/ChoiceEdge';
import { LoadDialog } from './components/LoadDialog';
import { buildGraph, FINISH_NODE_ID, ARROW_MARKER_ID } from './lib/graph';
import { layoutGraph } from './lib/layout';
import { computeMaxScore } from 'console-adventure';
import { FOUNDRY_EXAMPLE } from './lib/examples';
import { BLANK_ADVENTURE, STARTER_ADVENTURE } from './lib/blank';
import { createSave, storageAvailable } from './lib/storage';
import { updateChoice, addSceneFromChoice, deleteScene } from './lib/edit';
import { BootOverlay, shouldShowBootOverlay } from './components/BootOverlay';
import { ShipDialog } from './components/ShipDialog';
import { InlineSceneEditor } from './components/InlineSceneEditor';
import { ConfirmProvider, useConfirm } from './lib/confirm';
import { ScriptView } from './components/ScriptView';
import { ViewToggle } from './components/ViewToggle';
import { FlowDirectionToggle } from './components/FlowDirectionToggle';
import { loadViewMode, saveViewMode, type ViewMode } from './lib/viewMode';
import {
	loadFlowDirection,
	saveFlowDirection,
	type FlowDirection
} from './lib/flowDirection';
import type { PlayState } from './components/Terminal';

const EMPTY_PLAYSTATE: PlayState = {
	sceneId: null,
	finished: false,
	score: 0,
	visited: [],
	takenEdges: []
};
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
// Custom edge types. Lifted to module scope (matches nodeTypes
// pattern above) so React Flow doesn't see a new reference on
// every render and complain via its console warning.
const edgeTypes = { choice: ChoiceEdge };

/**
 * Outermost wrapper. The Provider is mounted here so any
 * descendant — including the inline scene editor portal — can
 * call `useReactFlow()` to get hold of the canvas instance and
 * convert flow coordinates to screen coordinates. Without it,
 * `useReactFlow()` throws "Zustand provider not found."
 */
export default function App() {
	return (
		<ConfirmProvider>
			<ReactFlowProvider>
				<AppInner />
			</ReactFlowProvider>
		</ConfirmProvider>
	);
}

function AppInner() {
	const confirm = useConfirm();
	const [json, setJson] = useState<AdventureJson>(FOUNDRY_EXAMPLE);
	const [jsonVersion, setJsonVersion] = useState(0);
	const [selectedScene, setSelectedScene] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showLoadDialog, setShowLoadDialog] = useState(false);
	const [showShipDialog, setShowShipDialog] = useState(false);
	const [currentSaveName, setCurrentSaveName] = useState<string | null>(null);
	// "Document is dirty" — set on every json edit; cleared on
	// save / load / new. Drives the saved-state dot in the
	// Toolbar. Lives in state rather than ref so the dot
	// re-renders when it flips.
	const [dirty, setDirty] = useState(false);
	// Boot overlay: shown once per browser unless the user
	// ticks "don't show on boot" inside it. The persisted skip
	// flag lives under `cas:skipBoot` — checked by
	// `shouldShowBootOverlay()` so the read is encapsulated.
	const [showBoot, setShowBoot] = useState<boolean>(() => shouldShowBootOverlay());
	// Move 02a: when the user clicks ⤢ on the inline editor we
	// want the right-panel SceneEditor to take focus. We don't
	// deselect (the node is still the subject of editing) — we
	// just suppress the floating card. Reset whenever the
	// selection changes so a fresh click on a different node
	// shows the inline card again.
	const [inlineCollapsed, setInlineCollapsed] = useState(false);
	useEffect(() => {
		setInlineCollapsed(false);
	}, [selectedScene]);

	// Move 03 — Playtest companion. The Terminal owns the actual
	// `Adventure` instance; it surfaces live state up through
	// `onStateChange` so the graph can mirror the run. We hold a
	// `playFrom` override here so "▶ play from here" buttons on
	// the inline editor can boot the playtest mid-graph without
	// mutating the document's `start`.
	const [playState, setPlayState] = useState<PlayState>(EMPTY_PLAYSTATE);
	const [playFrom, setPlayFrom] = useState<string | null>(null);
	const [playRequestId, setPlayRequestId] = useState(0);
	const [rightTab, setRightTab] = useState<Tab>('inspect');

	// Move 04 — top-level view mode (graph / write / split).
	// Persisted to localStorage so the author lands back in
	// whichever surface they were last in. Defaults to graph so
	// existing users see nothing change.
	const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
	const handleViewModeChange = useCallback((m: ViewMode) => {
		setViewMode(m);
		saveViewMode(m);
	}, []);

	// Flow direction (horizontal / vertical). Horizontal is the
	// default because the per-row source handles sit on the
	// right edge of each card -- pairing them with a left-edge
	// target on the next node gives clean wires. Vertical keeps
	// the legacy top-down layout for authors who prefer it.
	// Both branches structurally remount the graph (jsonVersion
	// bump) so fitView re-frames on the new orientation.
	const [flowDirection, setFlowDirection] = useState<FlowDirection>(() =>
		loadFlowDirection()
	);
	const handleFlowDirectionChange = useCallback((d: FlowDirection) => {
		setFlowDirection(d);
		saveFlowDirection(d);
		setJsonVersion((v) => v + 1);
	}, []);

	/**
	 * "▶ play from here" — boot the playtest at a specific
	 * scene, switch the right panel to the Play tab. The request
	 * id bumps even if the scene id is the same as before so
	 * Terminal's rebuild effect re-fires for a second click on
	 * the same node (otherwise React's equality check on
	 * `playFrom` skips the re-render entirely).
	 */
	const handlePlayFromHere = useCallback((sceneId: string) => {
		setPlayFrom(sceneId);
		setPlayRequestId((n) => n + 1);
		setRightTab('play');
	}, []);
	// Pre-compute lookup sets to keep the graph-rebuild useEffect
	// O(1) per node when it threads play flags through.
	const visitedSet = useMemo(() => new Set(playState.visited), [playState.visited]);
	const takenEdgeSet = useMemo(() => new Set(playState.takenEdges), [playState.takenEdges]);
	const liveSceneId = playState.sceneId;

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
		const built = buildGraph(json, maxScore, undefined, flowDirection);
		return {
			nodes: layoutGraph(built.nodes, built.edges, json.start, flowDirection),
			edges: built.edges
		};
	}, []);

	const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>(
		initialGraph.nodes
	);
	const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>(
		initialGraph.edges
	);

	// Sync into React Flow's state on subsequent json edits or
	// play-state changes (neither bumps jsonVersion / causes a
	// remount). Play-state changes flow `isLive` / `isVisited`
	// into each node's data, and re-style edges so the taken
	// path renders cyan — purely visual, no layout impact.
	const isFirstRenderRef = useRef(true);
	useEffect(() => {
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			return;
		}
		const built = buildGraph(
			json,
			maxScore,
			{
				liveSceneId,
				visited: visitedSet,
				takenEdges: takenEdgeSet
			},
			flowDirection
		);
		const positioned = layoutGraph(built.nodes, built.edges, json.start, flowDirection);
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
	}, [
		json,
		maxScore,
		liveSceneId,
		visitedSet,
		takenEdgeSet,
		flowDirection,
		setRfNodes,
		setRfEdges
	]);

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
			const edge: Edge | undefined = params.edges[0];
			setSelectedEdgeId(edge?.id ?? null);
		},
		[]
	);

	// React Flow's `onNodeClick` fires with the post-click node
	// state (`selected: true` regardless of whether selection
	// actually changed), so we can't tell from `node.selected`
	// alone whether the user clicked an already-selected node.
	// This ref tracks the selection AS OF THE PREVIOUS RENDER —
	// when onNodeClick fires synchronously during a click, the
	// ref still reflects the pre-click state. If it equals the
	// clicked node's id, the user clicked the same node twice in
	// a row → deselect.
	const prevSelectedRef = useRef<string | null>(null);
	useEffect(() => {
		prevSelectedRef.current = selectedScene;
	}, [selectedScene]);

	// Track which edge (if any) is currently selected — mirrors
	// `selectedScene` for the nodes side. We need our own copy
	// (rather than reading from rfEdges every time) because the
	// delete shortcut needs synchronous access to the choice
	// coords for the confirmation prompt.
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const prevSelectedEdgeRef = useRef<string | null>(null);
	useEffect(() => {
		prevSelectedEdgeRef.current = selectedEdgeId;
	}, [selectedEdgeId]);

	// Keyboard shortcut: Shift+L re-runs the auto layout. Skips
	// when the user is typing in an input/textarea so the
	// shortcut doesn't fight the inline editor's heading field
	// (capital L is a common letter to type).
	const handleAutoLayoutRef = useRef<() => void>(() => {});
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'L' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable
			) {
				return;
			}
			e.preventDefault();
			handleAutoLayoutRef.current();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	// Keyboard shortcut: Delete / Backspace deletes the
	// currently-selected scene, with a confirmation. Skips when
	// focus is in any editable field — Backspace inside the
	// heading textarea must keep deleting characters, not
	// torching the scene the author is typing into.
	const handleDeleteSelectedRef = useRef<() => void>(() => {});
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable
			) {
				return;
			}
			e.preventDefault();
			handleDeleteSelectedRef.current();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	const handleNodeClick = useCallback(
		(_e: React.MouseEvent, node: Node) => {
			if (prevSelectedRef.current === node.id) {
				// Toggle off — clear the selected flag on every
				// node so React Flow's `onSelectionChange` fires
				// with an empty array, which threads through to
				// setSelectedScene(null) via handleSelectionChange.
				setRfNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
			}
		},
		[setRfNodes]
	);

	/**
	 * Edge click toggle — same shape as the node-click toggle.
	 * If the user clicked the same edge twice in a row, clear
	 * every edge's `selected` flag and reset our tracking state.
	 * Otherwise let the default selection settle in: the click
	 * sets `selected: true` on the clicked edge, and our
	 * onSelectionChange handler picks it up.
	 */
	const handleEdgeClick = useCallback(
		(_e: React.MouseEvent, edge: Edge) => {
			if (prevSelectedEdgeRef.current === edge.id) {
				setRfEdges((prev) => prev.map((e) => ({ ...e, selected: false })));
				setSelectedEdgeId(null);
			}
		},
		[setRfEdges]
	);

	// React Flow instance — used by the auto-layout button to
	// re-frame the camera after positions get reset. Safe to
	// call here because AppInner sits inside <ReactFlowProvider>
	// (see the default export above).
	const reactFlow = useReactFlow();

	/**
	 * Re-run layoutGraph and overwrite every node's position.
	 * Useful after the user has hand-dragged nodes around the
	 * canvas — React Flow lets them park nodes wherever, but
	 * there's no built-in "tidy up" action. This brings the
	 * graph back to the BFS-derived top-down layout.
	 *
	 * We preserve the `selected` flag and don't bump
	 * `jsonVersion`, so the canvas re-positions in place rather
	 * than remounting and losing the selection.
	 */
	const handleAutoLayout = useCallback(() => {
		const built = buildGraph(
			json,
			maxScore,
			{
				liveSceneId,
				visited: visitedSet,
				takenEdges: takenEdgeSet
			},
			flowDirection
		);
		const positioned = layoutGraph(built.nodes, built.edges, json.start, flowDirection);
		setRfNodes((prev) => {
			const wasSelected = new Map(prev.map((n) => [n.id, !!n.selected]));
			return positioned.map((n) =>
				wasSelected.get(n.id) ? { ...n, selected: true } : n
			);
		});
		setRfEdges(built.edges);
		// Defer fitView so the new positions have committed
		// before the camera reads them. Without the
		// requestAnimationFrame the fitView lands on the OLD
		// positions and the visible tidy-up feels half-finished.
		requestAnimationFrame(() => {
			reactFlow.fitView({
				padding: 0.15,
				duration: 400,
				minZoom: DEFAULT_ZOOM,
				maxZoom: DEFAULT_ZOOM
			});
		});
	}, [
		json,
		maxScore,
		liveSceneId,
		visitedSet,
		takenEdgeSet,
		flowDirection,
		setRfNodes,
		setRfEdges,
		reactFlow
	]);

	// Keep the keyboard shortcut's ref pointing at the latest
	// closure — the listener itself only mounts once.
	useEffect(() => {
		handleAutoLayoutRef.current = handleAutoLayout;
	}, [handleAutoLayout]);

	/**
	 * Delete the currently-selected scene, with a confirmation.
	 * Bailout cases — silently no-op rather than nag:
	 *   - No scene is selected.
	 *   - The selected scene is the document's start (the engine
	 *     would have nowhere to begin). The inline editor's
	 *     delete button shows a "set start first" hint for this
	 *     case; from the keyboard there's no UI surface to
	 *     explain it, so silence is the right call.
	 *
	 * Also clears the selection so the inline editor unmounts
	 * cleanly after deletion.
	 */
	const handleDeleteSelected = useCallback(async () => {
		// Edge selection takes priority. "Delete the connection"
		// = rewire that choice's `next` to null (terminal). The
		// choice itself stays so the author keeps the label and
		// points — they just need to be rewired (or left as a
		// finish-leading option).
		if (selectedEdgeId) {
			const edge = rfEdges.find((e) => e.id === selectedEdgeId);
			const data = edge?.data as
				| { sceneId?: string; choiceIndex?: number }
				| undefined;
			if (!edge || data?.sceneId === undefined || data.choiceIndex === undefined) {
				return;
			}
			const fromScene = data.sceneId;
			const choiceIndex = data.choiceIndex;
			const choice = json.scenes[fromScene]?.choices[choiceIndex];
			if (!choice) return;
			const ok = await confirm({
				title: 'Delete connection',
				message: (
					<>
						Remove the link from <strong>{fromScene}</strong> choice{' '}
						<strong>
							{choiceIndex + 1}) {choice.label}
						</strong>{' '}
						→ <strong>{edge.target}</strong>? The choice stays in the scene
						but is rewired to <strong>finish</strong> (null).
					</>
				),
				confirmLabel: 'Delete connection',
				tone: 'danger'
			});
			if (!ok) return;
			setJson(updateChoice(json, fromScene, choiceIndex, { next: null }));
			setRfEdges((prev) => prev.map((e) => ({ ...e, selected: false })));
			setSelectedEdgeId(null);
			return;
		}
		if (!selectedScene) return;
		if (json.start === selectedScene) return;
		const ok = await confirm({
			title: 'Delete scene',
			message: (
				<>
					Delete scene <strong>{selectedScene}</strong>? Any choices pointing
					here will be rewired to <strong>finish</strong> (null).
				</>
			),
			confirmLabel: 'Delete',
			tone: 'danger'
		});
		if (!ok) return;
		const next = deleteScene(json, selectedScene);
		setJson(next);
		setSelectedScene(null);
		setRfNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
	}, [
		selectedScene,
		selectedEdgeId,
		rfEdges,
		json,
		setRfNodes,
		setRfEdges,
		confirm
	]);

	useEffect(() => {
		handleDeleteSelectedRef.current = handleDeleteSelected;
	}, [handleDeleteSelected]);

	// (Dev-only zoom tuning logger removed in Move 01 — the
	// DEFAULT_ZOOM value is now settled at 1.056 and the
	// console spam is no longer earning its keep.)

	// Edits stream in from the editor panels via this handler.
	// Default behaviour is "update in place" (no remount).
	// Callers pass `{ remount: true }` for structural changes
	// (start-scene swap) where they want fitView to re-run.
	const handleJsonChange = useCallback(
		(next: AdventureJson, opts?: { remount?: boolean }) => {
			setJson(next);
			setDirty(true);
			if (opts?.remount) setJsonVersion((v) => v + 1);
		},
		[]
	);

	/**
	 * Drag-to-wire: user dragged a choice's source handle onto
	 * another node and released. Parse the choice index out of
	 * the source handle id (`c-${i}`), then rewire the choice's
	 * `next` in-place — no remount, so the edge re-routes
	 * immediately and the node selection stays put.
	 *
	 * Dropping onto the synthetic finish node sets `next: null`
	 * so the wire-up matches the schema's terminal semantics.
	 */
	const handleConnect = useCallback(
		(c: Connection) => {
			const i = Number(c.sourceHandle?.replace('c-', ''));
			if (!c.source || Number.isNaN(i)) return;
			const next = c.target === FINISH_NODE_ID ? null : c.target;
			setJson((prev) => updateChoice(prev, c.source!, i, { next }));
		},
		[]
	);

	/**
	 * Drop-to-create: user dragged a choice's source handle onto
	 * empty canvas and released. v12 surfaces this via
	 * `onConnectEnd` with a `FinalConnectionState` whose
	 * `isValid` is false (no node target). Spawn a fresh scene,
	 * wire the choice to it, structurally remount so layout +
	 * fitView re-frame the graph around the new node, and select
	 * the new scene so the inline editor opens on it.
	 *
	 * Per the design handoff Decision A: we deliberately ignore
	 * the cursor drop coordinates — `layoutGraph` re-computes
	 * positions on every rebuild, so honouring the drop point
	 * would just look like a glitch as the node snaps to its
	 * BFS-derived slot.
	 */
	const handleConnectEnd = useCallback(
		(_event: MouseEvent | TouchEvent, conn: FinalConnectionState) => {
			if (conn.isValid) return; // onConnect already handled it
			const sourceId = conn.fromNode?.id;
			const i = Number(conn.fromHandle?.id?.replace('c-', ''));
			if (!sourceId || Number.isNaN(i)) return;
			// Drop-to-create can fire on accidental drags (release
			// too early, miss the target node). Confirm before
			// committing so a stray drag doesn't pollute the
			// adventure with empty stub scenes. The wording names
			// the source choice so the author knows what they're
			// agreeing to. We snapshot the choice label from the
			// current json BEFORE awaiting so the modal message is
			// derived from the same data that drove the drag.
			const choiceLabel =
				json.scenes[sourceId]?.choices[i]?.label ?? '(choice)';
			void confirm({
				title: 'Create new scene',
				message: (
					<>
						Create a new scene wired up to <strong>{choiceLabel}</strong>{' '}
						(choice {i + 1} of <strong>{sourceId}</strong>)?
					</>
				),
				confirmLabel: 'Create scene',
				tone: 'primary'
			}).then((ok) => {
				if (!ok) return;
				setJson((prev) => {
					const { json: nextJson, id } = addSceneFromChoice(prev, sourceId, i);
					queueMicrotask(() => {
						setSelectedScene(id);
						setJsonVersion((v) => v + 1);
					});
					return nextJson;
				});
			});
		},
		[json, confirm]
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
		setDirty(false);
	}

	function loadExample() {
		setJson(FOUNDRY_EXAMPLE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
		setDirty(false);
		setCurrentSaveName(null);
	}

	function newAdventure() {
		setJson(BLANK_ADVENTURE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(null);
		setError(null);
		setCurrentSaveName(null);
		setDirty(false);
	}

	/**
	 * Boot overlay's "start from a skeleton" path. Loads the
	 * three-scene branching scaffold and pre-selects the start
	 * scene so the editor opens populated and the author can
	 * type straight into the entrance heading.
	 */
	function newFromSkeleton() {
		setJson(STARTER_ADVENTURE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(STARTER_ADVENTURE.start);
		setError(null);
		setCurrentSaveName(null);
		setDirty(false);
	}

	/**
	 * Boot overlay's "tour the foundry" path. The example is
	 * already the default; this just ensures we're on it and
	 * preselects the start scene so the inspector shows scene
	 * content rather than the adventure-level view. The
	 * coachmark / tour itself is intentionally not implemented
	 * in this pass — see the Move 01 spec §"Guided tour" for
	 * the explicit stub-and-defer decision.
	 */
	function tourFoundry() {
		setJson(FOUNDRY_EXAMPLE);
		setJsonVersion((v) => v + 1);
		setSelectedScene(FOUNDRY_EXAMPLE.start);
		setError(null);
		setCurrentSaveName(null);
		setDirty(false);
	}

	/**
	 * Programmatic scene selection — closes any open modal AND
	 * highlights the named scene on the graph. Used by the
	 * Ship dialog's "jump to it" links on failing validation
	 * rows, and (eventually) by Move 02's validation surfaces.
	 *
	 * Updates both `selectedScene` (controls the right panel)
	 * AND the React Flow node `selected` flag (drives the
	 * visual highlight) — they're separate state in controlled
	 * mode and have to be synced manually.
	 */
	const handleJumpToScene = useCallback(
		(sceneId: string) => {
			setShowShipDialog(false);
			setSelectedScene(sceneId);
			setRfNodes((prev) =>
				prev.map((n) => ({ ...n, selected: n.id === sceneId }))
			);
		},
		[setRfNodes]
	);

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
		setDirty(false);
	}

	function loadFromStorage(loadedJson: AdventureJson, name: string) {
		setJson(loadedJson);
		setJsonVersion((v) => v + 1);
		setDirty(false);
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
			{showBoot && (
				<BootOverlay
					onClose={() => setShowBoot(false)}
					onTour={tourFoundry}
					onSkeleton={newFromSkeleton}
					onLoadJson={loadJson}
					onError={setError}
				/>
			)}

			<Toolbar
				documentName={currentSaveName ?? '(unsaved)'}
				dirty={dirty}
				stats={{ scenes: Object.keys(json.scenes).length, maxScore }}
				onLoadExample={loadExample}
				onLoadJson={loadJson}
				onNewAdventure={newAdventure}
				onSave={saveCurrent}
				onOpenLoadDialog={() => setShowLoadDialog(true)}
				onOpenShipDialog={() => setShowShipDialog(true)}
				onPlay={() => setRightTab('play')}
				onAutoLayout={handleAutoLayout}
				onResetZoom={() => {
					reactFlow.fitView({
						padding: 0.15,
						duration: 400,
						minZoom: DEFAULT_ZOOM,
						maxZoom: DEFAULT_ZOOM
					});
				}}
				saveAvailable={saveAvailable}
				onError={setError}
			/>

			{/* View-mode sub-bar — sits beneath the toolbar so
			    it's always visible without competing with the
			    load / save / ship actions for toolbar real
			    estate. Stats on the left double as a glance at
			    the document's shape. */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					padding: '6px 18px',
					background: PANEL,
					borderBottom: `1px solid ${PANEL_BORDER}`,
					fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
					fontSize: 10,
					color: DIM
				}}
			>
				<span>
					~/adventure ·{' '}
					<span style={{ color: PHOSPHOR }}>
						{Object.keys(json.scenes).length}
					</span>{' '}
					scenes ·{' '}
					<span style={{ color: PHOSPHOR }}>
						{Object.values(json.scenes).reduce((n, s) => n + s.choices.length, 0)}
					</span>{' '}
					choices · max <span style={{ color: PHOSPHOR }}>{maxScore}</span>
				</span>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<FlowDirectionToggle
						direction={flowDirection}
						onChange={handleFlowDirectionChange}
					/>
					<ViewToggle mode={viewMode} onChange={handleViewModeChange} />
				</div>
			</div>

			{showShipDialog && (
				<ShipDialog
					json={json}
					onClose={() => setShowShipDialog(false)}
					onJumpToScene={handleJumpToScene}
				/>
			)}

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

			{/* Inline scene editor only makes sense when the
			    graph is on-screen — it anchors to a node's
			    screen coords via the React Flow instance. Hidden
			    in write mode. */}
			{viewMode !== 'write' && selectedScene && !inlineCollapsed && (
				<InlineSceneEditor
					json={json}
					sceneId={selectedScene}
					onJsonChange={handleJsonChange}
					onClose={() => {
						setSelectedScene(null);
						setRfNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
					}}
					onExpand={() => setInlineCollapsed(true)}
					onPlayFromHere={() => handlePlayFromHere(selectedScene)}
					onSceneDeleted={() => {
						setSelectedScene(null);
						setRfNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
					}}
				/>
			)}

			<div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
				{/* ScriptView occupies the full canvas area in
				    write mode and the right half in split. The
				    graph canvas + right panel render in graph and
				    split modes (right panel only in graph — split
				    drops it to make room for the script). */}
				{viewMode === 'write' && (
					<ScriptView
						json={json}
						maxScore={maxScore}
						selectedSceneId={selectedScene}
						flowDirection={flowDirection}
						onJsonChange={handleJsonChange}
						onSelectScene={setSelectedScene}
						onPlayFromHere={(sceneId) => {
							handlePlayFromHere(sceneId);
							// In write mode there's no right panel,
							// so flip to graph so the Terminal that
							// "play from here" just booted is visible.
							handleViewModeChange('graph');
						}}
					/>
				)}

				{(viewMode === 'graph' || viewMode === 'split') && (
				<div style={{ flex: 1, position: 'relative' }}>
					<ReactFlow
						key={jsonVersion}
						nodes={rfNodes}
						edges={rfEdges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={handleConnect}
						onConnectEnd={handleConnectEnd}
						onNodeClick={handleNodeClick}
						onEdgeClick={handleEdgeClick}
						// Disable React Flow's built-in deletion key —
						// it would remove the node from the rfNodes
						// state without touching `json`, so the next
						// rebuild would resurrect it. Our own Delete /
						// Backspace handler (in App's useEffect) goes
						// through `deleteScene` instead so json stays
						// the source of truth.
						deleteKeyCode={null}
						connectionLineStyle={{
							stroke: PHOSPHOR,
							strokeWidth: 2,
							strokeDasharray: '2 5'
						}}
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						onSelectionChange={handleSelectionChange}
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

					{/* Auto-layout button — top-left so it stays
					    out of the way of React Flow's built-in
					    Controls at top-right. Tidies the canvas
					    after manual node-dragging by re-running
					    the BFS layout and fitting the view. */}
					<button
						onClick={handleAutoLayout}
						title="Re-run auto layout (Shift+L)"
						style={{
							position: 'absolute',
							top: 12,
							left: 12,
							background: PANEL,
							color: AMBER,
							border: `1px solid ${PANEL_BORDER}`,
							borderRadius: 5,
							padding: '5px 10px',
							fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
							fontSize: 11,
							cursor: 'pointer',
							transition: 'border-color 120ms, color 120ms, background 120ms'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.borderColor = AMBER;
							e.currentTarget.style.background = `${AMBER}11`;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.borderColor = PANEL_BORDER;
							e.currentTarget.style.background = PANEL;
						}}
					>
						⤢ auto layout
					</button>

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
						scroll to zoom · drag to pan · click scenes or connections to
						select · click again to deselect · Del to delete · Shift+L to
						tidy
					</div>

					{/* Restore-card chip — visible only when the user
					    expanded the inline editor into the side panel.
					    Lets them bring the floating card back without
					    losing selection. Bottom-right so it's out of the
					    way of the bottom-left controls hint. */}
					{selectedScene && inlineCollapsed && (
						<button
							onClick={() => setInlineCollapsed(false)}
							style={{
								position: 'absolute',
								bottom: 16,
								right: 16,
								background: PANEL,
								color: AMBER,
								border: `1px solid ${AMBER}`,
								borderRadius: 14,
								padding: '5px 11px',
								fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
								fontSize: 10,
								cursor: 'pointer',
								letterSpacing: '0.05em'
							}}
							title="Re-anchor the inline editor to the selected node"
						>
							⤡ show inline editor
						</button>
					)}
				</div>
				)}

				{/* Split mode — second half hosts the ScriptView.
				    Border on its left separates it visually from
				    the graph. Right panel is omitted in split to
				    make room (per the design handoff). */}
				{viewMode === 'split' && (
					<div
						style={{
							flex: 1,
							display: 'flex',
							borderLeft: `1px solid ${PANEL_BORDER}`,
							minWidth: 0
						}}
					>
						<ScriptView
							json={json}
							maxScore={maxScore}
							selectedSceneId={selectedScene}
							flowDirection={flowDirection}
							onJsonChange={handleJsonChange}
							onSelectScene={setSelectedScene}
							onPlayFromHere={(sceneId) => {
								handlePlayFromHere(sceneId);
								handleViewModeChange('graph');
							}}
						/>
					</div>
				)}

				{/* RightPanel rides alongside only in graph mode.
				    Split mode replaces it with the ScriptView half;
				    write mode is full-document. */}
				{viewMode === 'graph' && (
					<RightPanel
						json={json}
						jsonVersion={jsonVersion}
						maxScore={maxScore}
						selectedSceneId={selectedScene}
						playFrom={playFrom}
						playRequestId={playRequestId}
						tab={rightTab}
						onTabChange={setRightTab}
						onJsonChange={handleJsonChange}
						onSelectScene={setSelectedScene}
						onPlayStateChange={setPlayState}
						onClearPlayFrom={() => setPlayFrom(null)}
					/>
				)}
			</div>
		</div>
	);
}
