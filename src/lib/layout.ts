/**
 * Layered top-down auto-layout. Sceneing by BFS depth from the
 * start node, then spreading each layer horizontally.
 *
 * This is intentionally a hand-rolled algorithm (rather than
 * pulling in dagre or elkjs) — the adventures we render are
 * small (~10 scenes) and the layered look matches the SVG
 * diagram in docs/foundry-narrative.svg. Bigger / more
 * complex graphs would benefit from a proper layout engine.
 */
import type { Node, Edge } from '@xyflow/react';
import { FINISH_NODE_ID } from './graph.js';

const NODE_WIDTH = 320;
const NODE_HSPACING = 80;
const LAYER_VSPACING = 220;
const TOP_PADDING = 60;
const LEFT_PADDING = 60;

export function layoutGraph(
	nodes: Node[],
	edges: Edge[],
	startId: string
): Node[] {
	// Build adjacency for BFS.
	const successors = new Map<string, Set<string>>();
	for (const edge of edges) {
		if (!successors.has(edge.source)) successors.set(edge.source, new Set());
		successors.get(edge.source)!.add(edge.target);
	}

	// BFS depth from start. Nodes unreachable from start get a
	// large synthetic depth so they're rendered at the bottom in
	// their own row — visible but clearly disconnected.
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
	// layer below the deepest assigned layer.
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
	// Simple heuristic: sort by the average x-position of their
	// predecessors at the previous layer. For the start row,
	// alphabetical. We pass twice — once forward, once forward
	// again — which is enough for the small adventures we render.
	const xByNode = new Map<string, number>();
	const sortedDepths = [...byDepth.keys()].sort((a, b) => a - b);

	for (let pass = 0; pass < 2; pass++) {
		for (const d of sortedDepths) {
			const ids = byDepth.get(d)!;
			if (d === 0) {
				ids.sort();
			} else {
				// For each node, find predecessor average x.
				const predMean = new Map<string, number>();
				for (const id of ids) {
					const preds: number[] = [];
					for (const e of edges) {
						if (e.target === id && xByNode.has(e.source)) {
							preds.push(xByNode.get(e.source)!);
						}
					}
					predMean.set(
						id,
						preds.length
							? preds.reduce((a, b) => a + b, 0) / preds.length
							: 0
					);
				}
				ids.sort((a, b) => (predMean.get(a)! - predMean.get(b)!));
			}

			// Assign x positions for this layer, centred.
			const totalWidth = ids.length * NODE_WIDTH + (ids.length - 1) * NODE_HSPACING;
			const layerLeft = LEFT_PADDING + Math.max(0, (0 - totalWidth) / 2);
			ids.forEach((id, i) => {
				xByNode.set(id, layerLeft + i * (NODE_WIDTH + NODE_HSPACING));
			});
		}
	}

	// Apply positions back to the node list. Finish node gets
	// slightly extra vertical space so it reads as the conclusion.
	return nodes.map((node) => {
		const d = depth.get(node.id) ?? 0;
		const extraGap = node.id === FINISH_NODE_ID ? 40 : 0;
		return {
			...node,
			position: {
				x: xByNode.get(node.id) ?? 0,
				y: TOP_PADDING + d * LAYER_VSPACING + extraGap
			}
		};
	});
}
