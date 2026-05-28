/**
 * Layered auto-layout. Picks layers by BFS depth from the start
 * node, then spreads each layer along the cross-axis.
 *
 * Two flow directions are supported:
 *   - 'horizontal' (default): layers progress left → right,
 *     nodes within a layer stack top → bottom. Pairs cleanly
 *     with per-row source handles on the right edge of each
 *     SceneNode and a target on the left.
 *   - 'vertical': layers progress top → bottom (the legacy
 *     setup), nodes within a layer spread left → right.
 *
 * Intentionally hand-rolled rather than pulling in dagre / elkjs
 * — the adventures we render are small (~10 scenes) and the
 * layered look matches the SVG diagram in
 * docs/foundry-narrative.svg. Bigger / more complex graphs would
 * benefit from a proper layout engine.
 */
import type { Node, Edge } from '@xyflow/react';
import { FINISH_NODE_ID } from './graph.js';
import type { FlowDirection } from './flowDirection.js';

const NODE_WIDTH = 320;
const NODE_HEIGHT_ESTIMATE = 200; // rough avg — varies with choice count
const NODE_HSPACING = 80;
const NODE_VSPACING = 40;
const LAYER_HSPACING = 220; // distance between layers in horizontal flow
const LAYER_VSPACING = 220; // distance between layers in vertical flow
const TOP_PADDING = 60;
const LEFT_PADDING = 60;

export function layoutGraph(
	nodes: Node[],
	edges: Edge[],
	startId: string,
	direction: FlowDirection = 'horizontal'
): Node[] {
	// Build adjacency for BFS.
	const successors = new Map<string, Set<string>>();
	for (const edge of edges) {
		if (!successors.has(edge.source)) successors.set(edge.source, new Set());
		successors.get(edge.source)!.add(edge.target);
	}

	// BFS depth from start. Nodes unreachable from start get a
	// large synthetic depth so they're rendered at the end of
	// the flow in their own row — visible but clearly
	// disconnected.
	const depth = new Map<string, number>();
	depth.set(startId, 0);
	const queue: string[] = [startId];
	while (queue.length) {
		const id = queue.shift()!;
		const d = depth.get(id)!;
		for (const next of successors.get(id) ?? []) {
			if (!depth.has(next) || depth.get(next)! < d + 1) {
				depth.set(next, d + 1);
				queue.push(next);
			}
		}
	}

	// Anything that didn't get a depth (orphan scene) goes one
	// layer beyond the deepest assigned layer.
	const maxAssignedDepth = Math.max(...depth.values(), 0);
	for (const node of nodes) {
		if (!depth.has(node.id)) {
			depth.set(node.id, maxAssignedDepth + 1);
		}
	}

	// Group node ids by depth.
	const byDepth = new Map<number, string[]>();
	for (const node of nodes) {
		const d = depth.get(node.id)!;
		if (!byDepth.has(d)) byDepth.set(d, []);
		byDepth.get(d)!.push(node.id);
	}

	// Order the nodes within each layer to minimise edge crossings.
	// Simple heuristic: sort by the mean cross-axis position of
	// predecessors at the previous layer. For the start row,
	// alphabetical. Two passes — enough for the small adventures
	// we render.
	const crossByNode = new Map<string, number>(); // cross-axis position (y for horizontal, x for vertical)
	const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);

	const nodeSize = direction === 'horizontal' ? NODE_HEIGHT_ESTIMATE : NODE_WIDTH;
	const intraSpacing = direction === 'horizontal' ? NODE_VSPACING : NODE_HSPACING;
	const paddingCross = direction === 'horizontal' ? TOP_PADDING : LEFT_PADDING;

	for (let pass = 0; pass < 2; pass++) {
		for (const d of sortedDepths) {
			const ids = byDepth.get(d)!;
			if (d === 0) {
				ids.sort();
			} else {
				const predMean = new Map<string, number>();
				for (const id of ids) {
					const preds: number[] = [];
					for (const e of edges) {
						if (e.target === id && crossByNode.has(e.source)) {
							preds.push(crossByNode.get(e.source)!);
						}
					}
					predMean.set(
						id,
						preds.length
							? preds.reduce((a, b) => a + b, 0) / preds.length
							: 0
					);
				}
				ids.sort((a, b) => predMean.get(a)! - predMean.get(b)!);
			}

			// Assign cross-axis positions for this layer.
			ids.forEach((id, i) => {
				crossByNode.set(id, paddingCross + i * (nodeSize + intraSpacing));
			});
		}
	}

	// Apply positions back to the node list. Finish node gets
	// a touch of extra spacing so it reads as the conclusion.
	return nodes.map((node) => {
		const d = depth.get(node.id) ?? 0;
		const isFinish = node.id === FINISH_NODE_ID;
		const extraGap = isFinish ? 40 : 0;
		if (direction === 'horizontal') {
			return {
				...node,
				position: {
					x: LEFT_PADDING + d * (NODE_WIDTH + LAYER_HSPACING) + extraGap,
					y: crossByNode.get(node.id) ?? 0
				}
			};
		}
		return {
			...node,
			position: {
				x: crossByNode.get(node.id) ?? 0,
				y: TOP_PADDING + d * LAYER_VSPACING + extraGap
			}
		};
	});
}
