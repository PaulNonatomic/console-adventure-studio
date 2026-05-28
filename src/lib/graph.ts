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
import { AMBER, PANEL_BORDER, VOID } from './theme';
import { validate } from './validate';

// Static edge-styling constants, lifted to module scope so we
// don't allocate fresh objects per edge on every build of the
// graph. React Flow keeps references; lifting them here both
// trims allocations and gives a single place to tune edge
// appearance.
const EDGE_LABEL_STYLE = {
	fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
	fontSize: 10,
	fill: AMBER,
	fontWeight: 600
} as const;

const EDGE_LABEL_BG_STYLE = {
	fill: VOID,
	fillOpacity: 0.85,
	stroke: PANEL_BORDER,
	strokeWidth: 1
} as const;

const EDGE_STROKE_STYLE = { stroke: AMBER, strokeWidth: 1.5 } as const;

/**
 * Custom arrow marker referenced by ID. React Flow's
 * `arrowclosed` marker has `refX` at the centre of the
 * triangle, so the line draws all the way to the centre and
 * visually passes through the arrowhead's interior. Our marker
 * sits in the SVG defs block in `App.tsx` with `refX="1"` —
 * the line terminates just inside the triangle base instead,
 * no crossover.
 *
 * React Flow wraps a string `markerEnd` as `url('#${id}')`
 * internally, so we pass just the bare id — passing the
 * `url(...)` form here would double-wrap and break.
 */
export const ARROW_MARKER_ID = 'cas-arrow-base';
const ARROW_MARKER = ARROW_MARKER_ID;

const EDGE_LABEL_BG_PADDING: [number, number] = [6, 4];
const EDGE_LABEL_BG_RADIUS = 4;

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
	/**
	 * Validation flags computed in `buildGraph` and rendered
	 * as corner badges on the node. Shared with the ship dialog
	 * via `lib/validate.ts`.
	 */
	isUnreachable: boolean;
	isDeadEnd: boolean;
	hasMissingTarget: boolean;
	/** Number of choices across all scenes that point at this one. */
	inDegree: number;
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

	// Single pass over the graph for validation — same algorithm
	// the ship dialog uses. Result feeds the badges on each node.
	const v = validate(json);
	const unreachableSet = new Set(v.unreachable);
	const deadEndSet = new Set(v.deadEnds);
	const missingTargetScenes = new Set(v.missingTargets.map((m) => m.scene));

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
				isStart: sceneId === json.start,
				isUnreachable: unreachableSet.has(sceneId),
				isDeadEnd: deadEndSet.has(sceneId),
				hasMissingTarget: missingTargetScenes.has(sceneId),
				inDegree: v.inDegree[sceneId] ?? 0
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
				// Choice-addressed source handle — must match the
				// `id` set on the per-choice <Handle> in SceneNode.
				// Without this, edges fall back to React Flow's
				// default source slot and don't route from the row.
				sourceHandle: `c-${i}`,
				target,
				label: `${i + 1}) ${truncate(choice.label, 28)}${points ? `  +${points}` : ''}`,
				labelBgPadding: EDGE_LABEL_BG_PADDING,
				labelBgBorderRadius: EDGE_LABEL_BG_RADIUS,
				labelStyle: EDGE_LABEL_STYLE,
				labelBgStyle: EDGE_LABEL_BG_STYLE,
				style: EDGE_STROKE_STYLE,
				markerEnd: ARROW_MARKER
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
