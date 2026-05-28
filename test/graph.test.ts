/**
 * Tests for the graph builder — specifically the parallel-edge
 * merge behaviour. When a single source scene has multiple
 * choices that point at the SAME target, they collapse to a
 * single visual wire so the graph doesn't drown in parallel
 * lines. Per-choice handles still exist on the node (drag-to-
 * wire is unaffected); only the rendered edges merge.
 */
import { describe, it, expect } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import { buildGraph, FINISH_NODE_ID } from '../src/lib/graph';

function adventure(json: Partial<AdventureJson> & Pick<AdventureJson, 'scenes' | 'start'>): AdventureJson {
	return { ...json } as AdventureJson;
}

describe('buildGraph parallel-edge merging', () => {
	it('keeps a solo choice as its own edge with the per-choice handle', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [{ label: 'go b', next: 'b', points: 1 }]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 1);
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(1);
		expect(fromA[0].sourceHandle).toBe('c-0');
		expect(fromA[0].id).toBe('a-0-b');
	});

	it('merges two choices from the same scene pointing at the same target', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'left', next: 'b', points: 2 },
						{ label: 'right', next: 'b', points: 3 }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 5);
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(1);
		// Merged edge anchors at the first choice's row so the
		// wire still originates from a real handle, but the id is
		// the merged form so it can't collide with a solo edge.
		expect(fromA[0].sourceHandle).toBe('c-0');
		expect(fromA[0].id).toBe('a->b#merged');
		expect(fromA[0].type).toBe('merged');
		// Source handle ids carried through data so MergedEdge
		// can draw a spoke from each participating row.
		expect((fromA[0].data as { sourceHandleIds: string[] }).sourceHandleIds).toEqual([
			'c-0',
			'c-1'
		]);
		const label = fromA[0].label as string;
		expect(label).toContain('1) left');
		expect(label).toContain('2) right');
		expect(label).toContain('+2');
		expect(label).toContain('+3');
	});

	it('does NOT merge edges that share a source but have different targets', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'go b', next: 'b' },
						{ label: 'go c', next: 'c' }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] },
				c: { heading: 'C', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 0);
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(2);
		const targets = fromA.map((e) => e.target).sort();
		expect(targets).toEqual(['b', 'c']);
	});

	it('does NOT merge two scenes that point at the same target via different sources', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [{ label: 'go hub', next: 'hub' }]
				},
				b: {
					heading: 'B',
					narration: [''],
					choices: [{ label: 'go hub', next: 'hub' }]
				},
				hub: {
					heading: 'Hub',
					narration: [''],
					choices: [{ label: 'end', next: null }]
				}
			}
		});
		const { edges } = buildGraph(json, 0);
		// Two separate edges land at hub — one from a, one from b.
		const toHub = edges.filter((e) => e.target === 'hub');
		expect(toHub).toHaveLength(2);
	});

	it('merges multiple choices that all terminate (next: null) into one wire to finish', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'walk away', next: null, points: 0 },
						{ label: 'fall over', next: null, points: 0 },
						{ label: 'declare victory', next: null, points: 5 }
					]
				}
			}
		});
		const { edges } = buildGraph(json, 5);
		const finishEdges = edges.filter((e) => e.target === FINISH_NODE_ID);
		expect(finishEdges).toHaveLength(1);
		const label = finishEdges[0].label as string;
		expect(label).toContain('1) walk away');
		expect(label).toContain('2) fall over');
		// "declare victory" exceeds the 14-char per-choice
		// truncate budget that kicks in once edges merge, so
		// the assertion is on the truncated prefix — the
		// trailing ellipsis is what we'd see on the canvas.
		expect(label).toMatch(/3\) declare/);
		expect(label).toContain('+5');
	});

	it('marks a merged edge as taken if ANY constituent choice is taken', () => {
		const json = adventure({
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					choices: [
						{ label: 'left', next: 'b', points: 1 },
						{ label: 'right', next: 'b', points: 2 }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			}
		});
		const { edges } = buildGraph(json, 3, {
			liveSceneId: 'b',
			visited: new Set(['a', 'b']),
			// Took the second choice (a-1) — the merged edge
			// should still surface as taken (cyan).
			takenEdges: new Set(['a-1'])
		});
		const fromA = edges.filter((e) => e.source === 'a');
		expect(fromA).toHaveLength(1);
		const style = fromA[0].style as { stroke: string };
		// Taken style is keyed off CYAN; dim is keyed off
		// PANEL_BORDER. Either way the merged edge with one
		// taken constituent should NOT come back dim.
		expect(style.strokeWidth).toBeGreaterThanOrEqual(2);
	});
});
