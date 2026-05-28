/**
 * Top-level layout: toolbar across the top, graph canvas on
 * the left, inspector panel on the right.
 *
 * State held here:
 *   - `json`           — current AdventureJson (starts as foundry example)
 *   - `selectedScene`  — id of the selected scene node, or null
 *   - `error`          — last error message from a load action
 *
 * The graph re-builds whenever `json` changes; layout is
 * computed once per JSON via useMemo.
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
import { ScenePanel } from './components/ScenePanel';
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

	function handleLoadJson(parsed: unknown) {
		// Lightweight runtime check — the engine's own validator
		// runs at createAdventure time, but here we're not
		// instantiating; we just need enough confidence to render.
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
				onLoadExample={() => {
					setJson(FOUNDRY_EXAMPLE);
					setSelectedScene(null);
					setError(null);
				}}
				onLoadJson={handleLoadJson}
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
						nodes={nodes}
						edges={edges}
						nodeTypes={nodeTypes}
						onSelectionChange={handleSelectionChange}
						fitView
						fitViewOptions={{ padding: 0.15 }}
						minZoom={0.2}
						maxZoom={1.8}
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

				<ScenePanel
					json={json}
					maxScore={maxScore}
					selectedSceneId={selectedScene}
				/>
			</div>
		</div>
	);
}
