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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	type Node,
	type Edge,
	type OnSelectionChangeParams,
	BackgroundVariant,
	useNodesState,
	useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Toolbar } from './components/Toolbar';
import { RightPanel } from './components/RightPanel';
import { SceneNode } from './components/SceneNode';
import { FinishNode } from './components/FinishNode';
import { buildGraph, FINISH_NODE_ID } from './lib/graph';
import { layoutGraph } from './lib/layout';
import { computeMaxScore } from './lib/maxScore';
import { FOUNDRY_EXAMPLE } from './lib/examples';
import { BLANK_ADVENTURE } from './lib/blank';
import { VOID, PHOSPHOR, MAGENTA, AMBER, DIM, PANEL, PANEL_BORDER } from './lib/theme';
import type { AdventureJson } from 'console-adventure';

const nodeTypes = { scene: SceneNode, finish: FinishNode };

export default function App() {
	const [json, setJson] = useState<AdventureJson>(FOUNDRY_EXAMPLE);
	const [jsonVersion, setJsonVersion] = useState(0);
	const [selectedScene, setSelectedScene] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
	const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

	const maxScore = useMemo(() => computeMaxScore(json), [json]);

	// Rebuild the React Flow nodes + edges whenever the json
	// changes. Setter functions are stable (useNodesState gives
	// them a fixed identity per mount) so this effect runs
	// strictly on json / maxScore changes, not on every render.
	useEffect(() => {
		const built = buildGraph(json, maxScore);
		setRfNodes(layoutGraph(built.nodes, built.edges, json.start));
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
				onError={setError}
			/>

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
						fitView
						fitViewOptions={{
							nodes: focusNodeIds.map((id) => ({ id })),
							padding: 0.15,
							minZoom: 1,
							maxZoom: 1.6
						}}
						minZoom={0.2}
						maxZoom={2}
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
