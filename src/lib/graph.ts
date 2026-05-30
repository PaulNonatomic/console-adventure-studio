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
import { AMBER, CYAN, PANEL_BORDER } from './theme';
import { validate } from './validate';
import type { FlowDirection } from './flowDirection';

// Static edge-styling constants, lifted to module scope so we
// don't allocate fresh objects per edge on every build of the
// graph. React Flow keeps references; lifting them here both
// trims allocations and gives a single place to tune edge
// appearance.
//
// No edge labels -- the choice's text + points live in the
// source node's choice row, and a label on the wire as well
// just made the graph noisy at any zoom level. The wire itself
// carries "this choice connects A → B"; the row is the source
// of truth for what the choice says.
const EDGE_STROKE_STYLE = { stroke: AMBER, strokeWidth: 1.5 } as const;
/**
 * Style applied to edges along the taken playtest path. Cyan
 * matches the live-scene highlight on nodes so the eye can
 * follow the run as one continuous trail across the graph.
 */
const EDGE_STROKE_STYLE_TAKEN = { stroke: CYAN, strokeWidth: 2 } as const;
/**
 * Style applied to edges that have NOT been taken once a
 * playtest is in progress. Dimmed and dashed so the taken path
 * pops; without this, every edge stays amber and the cyan path
 * gets visually lost.
 */
const EDGE_STROKE_STYLE_DIM = {
	stroke: PANEL_BORDER,
	strokeWidth: 1,
	strokeDasharray: '4 4'
} as const;

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
	/**
	 * Playtest companion flags. `isLive` = the scene the playtest
	 * is currently in. `isVisited` = a scene the playtest has
	 * passed through earlier in the run. Both false when no
	 * playtest is running. SceneNode renders these as a cyan
	 * glow + "▶ YOU ARE HERE" / "✓ VISITED" tags.
	 */
	isLive: boolean;
	isVisited: boolean;
	/**
	 * Number of items present in this scene at the start of a
	 * run, from `Scene.items`. Drives the small ◆ badge on the
	 * SceneNode so authors can see at a glance which scenes
	 * carry pickable items.
	 */
	itemCount: number;
	/**
	 * Current global flow direction. Threaded onto every scene
	 * node so SceneNode can pick the correct target-handle edge
	 * (Left when horizontal, Top when vertical). Denorm but
	 * cheap — direction changes are rare and rebuild the whole
	 * graph anyway.
	 */
	flowDirection: FlowDirection;
}

/**
 * Playtest state threaded into `buildGraph` so node + edge
 * styling can mirror the current run. All optional — when no
 * playtest is in progress (or no override is supplied), graphs
 * build with their default amber styling.
 */
export interface PlayHighlight {
	liveSceneId: string | null;
	visited: Set<string>;
	/** Edge ids on the taken path, formatted `${sceneId}-${choiceIndex}`. */
	takenEdges: Set<string>;
}

export interface FinishNodeData extends Record<string, unknown> {
	tiers?: Array<{ minScore: number; label: string; color?: string }>;
	maxScore: number;
	flowDirection: FlowDirection;
}

export const FINISH_NODE_ID = '__finish__';

export function buildGraph(
	json: AdventureJson,
	maxScore: number,
	play?: PlayHighlight,
	flowDirection: FlowDirection = 'horizontal'
): {
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

	const liveSceneId = play?.liveSceneId ?? null;
	const visitedSet = play?.visited ?? new Set<string>();
	const takenEdgeSet = play?.takenEdges ?? new Set<string>();
	const hasActiveRun = liveSceneId !== null || visitedSet.size > 0;

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
				inDegree: v.inDegree[sceneId] ?? 0,
				isLive: sceneId === liveSceneId,
				isVisited: visitedSet.has(sceneId) && sceneId !== liveSceneId,
				itemCount: scene.items?.length ?? 0,
				flowDirection
			} satisfies SceneNodeData
		});

		// One edge per choice, every time. Parallel wires from N
		// choices to the same target are now allowed -- the
		// previous "collapse them into one bundle" treatment was
		// confusing (the visual stopped mapping to the choice
		// list one-for-one).
		scene.choices.forEach((choice, choiceIndex) => {
			const target = choice.next ?? FINISH_NODE_ID;
			// Edge style switches on the run:
			//   - run active + this edge taken → cyan thick
			//   - run active + not taken → dim dashed
			//   - no run → default amber
			const taken = takenEdgeSet.has(`${sceneId}-${choiceIndex}`);
			const style = hasActiveRun
				? taken
					? EDGE_STROKE_STYLE_TAKEN
					: EDGE_STROKE_STYLE_DIM
				: EDGE_STROKE_STYLE;
			edges.push({
				id: `${sceneId}-${choiceIndex}-${target}`,
				source: sceneId,
				// Choice-addressed source handle — must match the
				// `id` set on the per-choice <Handle> in SceneNode.
				sourceHandle: `c-${choiceIndex}`,
				target,
				type: 'choice',
				// Carry the choice coordinates through `data` so
				// the keyboard delete shortcut can find which
				// choice to rewire when an edge is selected.
				data: { sceneId, choiceIndex },
				style,
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
			data: { tiers: json.tiers, maxScore, flowDirection } satisfies FinishNodeData
		});
	}

	return { nodes, edges };
}

