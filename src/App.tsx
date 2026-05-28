/**
 * Top-level layout: toolbar across the top, graph canvas on
 * the left, tabbed RightPanel on the right (Inspect / Play).
 *
 * State held here:
 *   - `json`           — current AdventureJson (starts as foundry example)
 *   - `jsonVersion`    — counter incremented on every load,
 *                        used as the ReactFlow `key` so the
 *                        graph cleanly remounts (and re-runs
 *                        fitView) when the user loads a
 *                        different adventure
 *   - `selectedScene`  — id of the selected scene node, or null
 *   - `error`          — last error message from a load action
 *
 * The graph runs in *uncontrolled* mode: nodes / edges go in
 * via `defaultNodes` / `defaultEdges` and React Flow owns
 * selection state internally. Earlier versions passed them as
 * controlled `nodes` / `edges` without an `onNodesChange`
 * handler, which left React Flow unable to propagate selection
 * to some nodes — clicks visibly did nothing on certain scenes.
 * Bumping the JSON version key re-mounts the canvas when the
 * user loads new data.
 */
import { useCallback, useMemo, useState } from 'react';
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	type Node,
	type OnSelectionChangeParams,
	BackgroundVariant
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
import { VOID, PHOSPHOR, MAGENTA, AMBER, DIM, PANEL, PANEL_BORDER } from './lib/theme';
import type { AdventureJson } from 'console-adventure';

const nodeTypes = { scene: SceneNode, finish: FinishNode };

export default function App() {
	const [json, setJson] = useState<AdventureJson>(FOUNDRY_EXAMPLE);
	const [jsonVersion, setJsonVersion] = useState(0);
	const [selectedScene, setSelectedScene] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const maxScore = useMemo(() => computeMaxScore(json), [json]);

	const { nodes, edges } = useMemo(() => {
		const built = buildGraph(json, maxScore);
		return {
			nodes: layoutGraph(built.nodes, built.edges, json.start),
			edges: built.edges
		};
	}, [json, maxScore]);

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
			<Toolbar onLoadExample={loadExample} onLoadJson={loadJson} onError={setError} />

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
						// Remount when the loaded JSON changes so React
						// Flow re-runs fitView and clears any stale
						// internal selection state.
						key={jsonVersion}
						defaultNodes={nodes}
						defaultEdges={edges}
						nodeTypes={nodeTypes}
						onSelectionChange={handleSelectionChange}
						fitView
						// Push fitView's auto-fit floor up further per
						// playtest feedback — at <1.0x the choice labels
						// in node bodies become hard to read.
						fitViewOptions={{ padding: 0.08, minZoom: 1, maxZoom: 1.6 }}
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
						scroll to zoom · drag to pan · click a scene to inspect
					</div>
				</div>

				<RightPanel
					json={json}
					maxScore={maxScore}
					selectedSceneId={selectedScene}
				/>
			</div>
		</div>
	);
}
