/**
 * Convert an `AdventureJson` into the nodes + edges arrays
 * React Flow consumes.
 *
 * - Each scene becomes a node with a `type: "scene"` so the
 *   custom `SceneNode` renderer takes over (see
 *   ../components/SceneNode.tsx).
 * - Each choice becomes an edge from its parent scene to the
 *   `next` scene, labeled with the choice text + points. Choices
 *   whose `next` is `null` (terminal) connect to a synthetic
 *   "finish" node so dangling ends are visible rather than
 *   missing from the graph.
 *
 * Layout is applied by `./layout.ts` afterwards. This module
 * just produces *unpositioned* nodes/edges.
 */
import type { Node, Edge } from '@xyflow/react';
import type { AdventureJson } from 'console-adventure';

export interface SceneNodeData extends Record<string, unknown> {
	sceneId: string;
	heading: string;
	narration: string[];
	choices: Array<{
		label: string;
		points?: number;
		flavour?: string;
		next: string | null;
	}>;
	isStart: boolean;
}

export interface FinishNodeData extends Record<string, unknown> {
	tiers?: Array<{ minScore: number; label: string; color?: string }>;
	maxScore: number;
}

export const FINISH_NODE_ID = '__finish__';

export function buildGraph(json: AdventureJson, maxScore: number): {
	nodes: Node[];
	edges: Edge[];
} {
	const nodes: Node[] = [];
	const edges: Edge[] = [];

	// Scene nodes.
	for (const [sceneId, scene] of Object.entries(json.scenes)) {
		nodes.push({
			id: sceneId,
			type: 'scene',
			position: { x: 0, y: 0 }, // assigned by layout
			data: {
				sceneId,
				heading: scene.heading,
				narration: scene.narration,
				choices: scene.choices,
				isStart: sceneId === json.start
			} satisfies SceneNodeData
		});

		// One edge per choice. ID encodes source + choice index +
		// target so multiple choices going to the same next scene
		// don't collide.
		scene.choices.forEach((choice, i) => {
			const target = choice.next ?? FINISH_NODE_ID;
			const points = choice.points ?? 0;
			edges.push({
				id: `${sceneId}-${i}-${target}`,
				source: sceneId,
				target,
				label: `${i + 1}) ${truncate(choice.label, 28)}${points ? `  +${points}` : ''}`,
				labelBgPadding: [6, 4],
				labelBgBorderRadius: 4,
				labelStyle: {
					fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
					fontSize: 10,
					fill: '#F5A623',
					fontWeight: 600
				},
				labelBgStyle: {
					fill: '#0A0A0F',
					fillOpacity: 0.85,
					stroke: '#252535',
					strokeWidth: 1
				},
				style: { stroke: '#F5A623', strokeWidth: 1.5 },
				// React Flow's default arrow marker:
				markerEnd: { type: 'arrowclosed', color: '#F5A623', width: 18, height: 18 } as Edge['markerEnd']
			});
		});
	}

	// Synthetic finish node, only added if at least one choice
	// terminates. Keeps the graph clean for adventures that loop
	// forever (none of ours do, but the engine allows it).
	const hasTerminal = Object.values(json.scenes).some((s) =>
		s.choices.some((c) => c.next === null)
	);
	if (hasTerminal) {
		nodes.push({
			id: FINISH_NODE_ID,
			type: 'finish',
			position: { x: 0, y: 0 },
			data: { tiers: json.tiers, maxScore } satisfies FinishNodeData
		});
	}

	return { nodes, edges };
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
